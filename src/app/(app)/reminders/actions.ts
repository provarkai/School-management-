"use server";

import { fetchAllRowsByIds } from "@/lib/fetchAll";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { feeReminderTemplate, sendReminderMessage } from "@/lib/termii";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";

export interface BulkReminderResult {
  sent: number;
  skippedNoPhone: number;
  failed: { studentName: string; error: string }[];
  mocked: boolean;
}

export async function sendBulkReminders(studentIds: string[]): Promise<BulkReminderResult> {
  const { school } = await requireProprietor();
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = (school?.current_term ?? "1") as Term;

  // Chunked and paged: "select all" on a large school sends more ids than
  // fit in one request, and anyone dropped would simply never be messaged
  // while the run still reported success.
  const [students, fees] = await Promise.all([
    fetchAllRowsByIds<{
      id: string;
      full_name: string;
      parent_name: string | null;
      parent_phone: string | null;
    }>(studentIds, (chunk, from, to) =>
      supabase
        .from("students")
        .select("id, full_name, parent_name, parent_phone")
        .in("id", chunk)
        .order("id")
        .range(from, to)
    ),
    fetchAllRowsByIds<{ student_id: string; balance: number }>(
      studentIds,
      (chunk, from, to) =>
        supabase
          .from("fee_summary")
          .select("student_id, balance")
          .in("student_id", chunk)
          .eq("session", session)
          .eq("term", term)
          .order("fee_record_id")
          .range(from, to)
    ),
  ]);

  const balanceByStudent = new Map(fees.map((f) => [f.student_id, Number(f.balance)]));

  let sent = 0;
  let skippedNoPhone = 0;
  const failed: { studentName: string; error: string }[] = [];
  let mocked = false;

  for (const student of students) {
    if (!student.parent_phone) {
      skippedNoPhone++;
      continue;
    }

    const balance = balanceByStudent.get(student.id) ?? 0;
    if (balance <= 0) continue;

    const message = feeReminderTemplate({
      parentName: student.parent_name || "Parent",
      studentName: student.full_name,
      balance: naira(balance),
      termLabel: TERM_LABELS[term],
      schoolName: school?.name ?? "the school",
    });

    const result = await sendReminderMessage(student.parent_phone, message);
    if (result.mocked) mocked = true;
    if (result.ok) sent++;
    else failed.push({ studentName: student.full_name, error: result.error ?? "Unknown error" });
  }

  return { sent, skippedNoPhone, failed, mocked };
}
