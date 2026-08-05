import { fetchAllRows, fetchAllRowsByIds } from "@/lib/fetchAll";
import { createAdminClient } from "@/lib/supabase/server";
import { cronUnauthorizedResponse, isAuthorizedCronRequest } from "@/lib/cronAuth";
import { feeReminderTemplate } from "@/lib/sms";
import { sendAndLogMessage } from "@/lib/messageLog";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";

export const maxDuration = 60;

/**
 * Vercel Cron target — sends a fee reminder to every parent whose child is
 * owing or partially paid, across every school. Scheduled weekly in
 * vercel.json. Deferred automation from the MVP spec's "Reminders" section
 * ("Automate later (Phase 2)").
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const supabase = createAdminClient();

  const { data: schools, error: schoolsError } = await supabase
    .from("schools")
    .select("id, name, current_session, current_term");

  if (schoolsError) {
    return Response.json({ error: schoolsError.message }, { status: 500 });
  }

  let totalSent = 0;
  let totalSkipped = 0;
  const failures: string[] = [];

  for (const school of schools ?? []) {
    const term = school.current_term as Term;

    // Read in full — a short read here means some parents simply never
    // get their reminder, with nothing in the logs to say so.
    const fees = await fetchAllRows<{ student_id: string; balance: number }>((from, to) =>
      supabase
        .from("fee_summary")
        .select("student_id, balance")
        .eq("school_id", school.id)
        .eq("session", school.current_session)
        .eq("term", term)
        .neq("status", "paid")
        .order("fee_record_id")
        .range(from, to)
    );

    const balanceByStudent = new Map<string, number>();
    for (const f of fees) {
      if (Number(f.balance) <= 0) continue;
      balanceByStudent.set(f.student_id, (balanceByStudent.get(f.student_id) ?? 0) + Number(f.balance));
    }
    const owingStudentIds = Array.from(balanceByStudent.keys());
    if (owingStudentIds.length === 0) continue;

    const students = await fetchAllRowsByIds<{
      id: string;
      full_name: string;
      parent_name: string | null;
      parent_phone: string | null;
    }>(owingStudentIds, (chunk, from, to) =>
      supabase
        .from("students")
        .select("id, full_name, parent_name, parent_phone")
        .in("id", chunk)
        .eq("status", "active")
        .order("id")
        .range(from, to)
    );

    for (const student of students) {
      if (!student.parent_phone) {
        totalSkipped++;
        continue;
      }

      const message = feeReminderTemplate({
        parentName: student.parent_name || "Parent",
        studentName: student.full_name,
        balance: naira(balanceByStudent.get(student.id) ?? 0),
        termLabel: TERM_LABELS[term],
        schoolName: school.name,
      });

      const result = await sendAndLogMessage(
        supabase,
        {
          schoolId: school.id,
          purpose: "fee_reminder",
          recipientName: student.parent_name,
          studentId: student.id,
        },
        student.parent_phone,
        message
      );
      if (result.ok) totalSent++;
      else failures.push(`${school.name}/${student.full_name}: ${result.error}`);
    }
  }

  return Response.json({ sent: totalSent, skippedNoPhone: totalSkipped, failures });
}
