"use server";

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

  const [{ data: students }, { data: fees }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, parent_name, parent_phone")
      .in("id", studentIds),
    supabase
      .from("fee_summary")
      .select("student_id, balance")
      .in("student_id", studentIds)
      .eq("session", session)
      .eq("term", term),
  ]);

  const balanceByStudent = new Map((fees ?? []).map((f) => [f.student_id, Number(f.balance)]));

  let sent = 0;
  let skippedNoPhone = 0;
  const failed: { studentName: string; error: string }[] = [];
  let mocked = false;

  for (const student of students ?? []) {
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

export interface GeneralAnnouncementState {
  error?: string;
  success?: string;
}

export async function sendGeneralAnnouncement(
  _prevState: GeneralAnnouncementState,
  formData: FormData
): Promise<GeneralAnnouncementState> {
  await requireProprietor();
  const supabase = await createClient();

  const message = String(formData.get("message") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "").trim() || null;

  if (!message) {
    return { error: "Message is required." };
  }

  let query = supabase
    .from("students")
    .select("parent_phone")
    .eq("status", "active")
    .not("parent_phone", "is", null);
  if (classId) query = query.eq("class_id", classId);

  const { data: students } = await query;

  let sent = 0;
  let mocked = false;
  for (const student of students ?? []) {
    if (!student.parent_phone) continue;
    const result = await sendReminderMessage(student.parent_phone, message);
    if (result.mocked) mocked = true;
    if (result.ok) sent++;
  }

  return {
    success: `Sent to ${sent} parent(s).${mocked ? " (mock mode — set TERMII_API_KEY to send for real)" : ""}`,
  };
}
