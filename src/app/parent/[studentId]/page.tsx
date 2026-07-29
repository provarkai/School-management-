import { notFound } from "next/navigation";
import Link from "next/link";
import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";

export default async function ParentChildPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { children } = await requireParent();

  const child = children.find((c) => c.id === studentId);
  if (!child) notFound();

  const supabase = await createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("name, current_session, current_term")
    .eq("id", child.school_id)
    .single();

  const session = school?.current_session ?? "";
  const term = (school?.current_term ?? "1") as Term;

  const [{ data: fee }, { data: attendance }, { data: results }] = await Promise.all([
    supabase
      .from("fee_summary")
      .select("amount_expected, amount_paid, balance, status")
      .eq("student_id", child.id)
      .eq("session", session)
      .eq("term", term)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("status")
      .eq("student_id", child.id)
      .gte("date", new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)),
    supabase
      .from("results")
      .select("subject, ca_score, exam_score, total, grade")
      .eq("student_id", child.id)
      .eq("session", session)
      .eq("term", term)
      .order("subject"),
  ]);

  const attendanceRows = attendance ?? [];
  const present = attendanceRows.filter((a) => a.status === "present").length;
  const attendanceRate = attendanceRows.length
    ? Math.round((present / attendanceRows.length) * 100)
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/parent" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← All children
      </Link>

      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {school?.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{child.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {child.className ?? "—"} · {session} · {TERM_LABELS[term]}
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">School fees</h2>
        {fee ? (
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
        ) : (
          <p className="text-sm text-zinc-400">No fee record for this term yet.</p>
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
        {(results ?? []).length === 0 ? (
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
    </div>
  );
}
