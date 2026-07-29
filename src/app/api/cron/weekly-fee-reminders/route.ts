import { createAdminClient } from "@/lib/supabase/server";
import { feeReminderTemplate, sendReminderMessage } from "@/lib/termii";
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
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
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

    const { data: fees } = await supabase
      .from("fee_summary")
      .select("student_id, balance")
      .eq("school_id", school.id)
      .eq("session", school.current_session)
      .eq("term", term)
      .neq("status", "paid");

    const balanceByStudent = new Map<string, number>();
    for (const f of fees ?? []) {
      if (Number(f.balance) <= 0) continue;
      balanceByStudent.set(f.student_id, (balanceByStudent.get(f.student_id) ?? 0) + Number(f.balance));
    }
    const owingStudentIds = Array.from(balanceByStudent.keys());
    if (owingStudentIds.length === 0) continue;

    const { data: students } = await supabase
      .from("students")
      .select("id, full_name, parent_name, parent_phone")
      .in("id", owingStudentIds)
      .eq("status", "active");

    for (const student of students ?? []) {
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

      const result = await sendReminderMessage(student.parent_phone, message);
      if (result.ok) totalSent++;
      else failures.push(`${school.name}/${student.full_name}: ${result.error}`);
    }
  }

  return Response.json({ sent: totalSent, skippedNoPhone: totalSkipped, failures });
}
