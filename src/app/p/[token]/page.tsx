import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";
import { checkFeeGate } from "@/lib/feeGate";

export const dynamic = "force-dynamic";

export default async function ParentViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, class_id, school_id, parent_name")
    .eq("access_token", token)
    .maybeSingle();

  if (!student) notFound();

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, logo_url, current_session, current_term, status, withhold_results_when_owing")
    .eq("id", student.school_id)
    .single();

  if (school?.status === "suspended") notFound();

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  const session = school?.current_session ?? "";
  const term = (school?.current_term ?? "1") as Term;

  const [{ data: fees }, { data: attendance }, { data: results }, { data: exams }] = await Promise.all([
    supabase
      .from("fee_summary")
      .select("fee_type_id, fee_type_name, amount_expected, amount_paid, balance, status")
      .eq("student_id", student.id)
      .eq("session", session)
      .eq("term", term),
    supabase
      .from("attendance")
      .select("status")
      .eq("student_id", student.id)
      .gte("date", new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)),
    supabase
      .from("results")
      .select("subject, ca_score, exam_score, total, grade")
      .eq("student_id", student.id)
      .eq("session", session)
      .eq("term", term)
      .order("subject"),
    student.class_id
      ? supabase
          .from("exams")
          .select("id, title, subject, status")
          .eq("class_id", student.class_id)
          .eq("session", session)
          .eq("term", term)
          .in("status", ["published", "closed"])
      : Promise.resolve({ data: [] }),
  ]);

  const examIds = (exams ?? []).map((e) => e.id);
  const { data: attempts } =
    examIds.length > 0
      ? await supabase
          .from("exam_attempts")
          .select("exam_id, submitted_at, score, max_score")
          .eq("student_id", student.id)
          .in("exam_id", examIds)
      : { data: [] };
  const attemptByExam = new Map((attempts ?? []).map((a) => [a.exam_id, a]));

  const gate = await checkFeeGate(
    supabase,
    student.school_id,
    student.id,
    session,
    term,
    school?.withhold_results_when_owing ?? false
  );

  const attendanceRows = attendance ?? [];
  const present = attendanceRows.filter((a) => a.status === "present").length;
  const attendanceRate = attendanceRows.length
    ? Math.round((present / attendanceRows.length) * 100)
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-6 bg-zinc-50 px-4 py-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {school?.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{student.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {klass?.name ?? "—"} · {session} · {TERM_LABELS[term]}
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">School fees</h2>
        {(fees ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No fee record for this term yet.</p>
        ) : (
          (fees ?? []).map((fee) => (
            <div key={fee.fee_type_id} className="border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0">
              <p className="mb-2 text-sm font-medium text-zinc-700">{fee.fee_type_name}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-zinc-400">Expected</p>
                  <p className="font-semibold text-zinc-900">{naira(Number(fee.amount_expected))}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Paid</p>
                  <p className="font-semibold text-zinc-900">{naira(Number(fee.amount_paid))}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Balance</p>
                  <p className={`font-semibold ${Number(fee.balance) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {naira(Number(fee.balance))}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Attendance (last 30 days)</h2>
        {attendanceRate === null ? (
          <p className="text-sm text-zinc-400">No attendance recorded yet.</p>
        ) : (
          <p className="text-2xl font-bold text-zinc-900">
            {attendanceRate}%{" "}
            <span className="text-sm font-normal text-zinc-400">
              present ({present}/{attendanceRows.length} days)
            </span>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Results — {TERM_LABELS[term]}</h2>
        {gate.withheld ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Results are held pending payment of the outstanding {naira(gate.balance)}. Please
            contact the school office.
          </p>
        ) : (results ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No scores entered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                <th className="py-1 font-medium">Subject</th>
                <th className="py-1 text-right font-medium">Total</th>
                <th className="py-1 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(results ?? []).map((r) => (
                <tr key={r.subject}>
                  <td className="py-1.5 text-zinc-900">{r.subject}</td>
                  <td className="py-1.5 text-right text-zinc-500">{r.total}/100</td>
                  <td className="py-1.5 text-right font-medium text-zinc-900">{r.grade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(exams ?? []).length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Exams</h2>
          <ul className="space-y-2">
            {(exams ?? []).map((e) => {
              const attempt = attemptByExam.get(e.id);
              const statusLabel = attempt?.submitted_at
                ? `Submitted · ${attempt.score}/${attempt.max_score}`
                : attempt
                  ? "In progress"
                  : e.status === "closed"
                    ? "Closed"
                    : "Not started";
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-900">
                    {e.title}
                    {e.subject ? ` (${e.subject})` : ""}
                  </span>
                  {attempt || e.status === "published" ? (
                    <Link
                      href={`/p/${token}/exams/${e.id}`}
                      className="shrink-0 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      {statusLabel} →
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-400">{statusLabel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-zinc-400">
        This is a read-only summary shared by {school?.name}. Contact the school office with
        any questions.
      </p>
    </div>
  );
}
