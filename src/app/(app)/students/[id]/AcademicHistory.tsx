import { naira } from "@/lib/format";
import { computeGPA } from "@/lib/grading";
import { TERM_LABELS, type Term } from "@/lib/types";

interface ResultRow {
  session: string;
  term: string;
  subject: string;
  total: number;
  grade: string | null;
}

interface FeeRow {
  session: string;
  term: string;
  fee_type_name: string;
  amount_expected: number;
  amount_paid: number;
  balance: number;
  status: string;
}

interface AttendanceRow {
  status: string;
}

function sortPeriodsDesc<T extends { session: string; term: string }>(keys: T[]): T[] {
  return [...keys].sort((a, b) => {
    if (a.session !== b.session) return b.session.localeCompare(a.session);
    return Number(b.term) - Number(a.term);
  });
}

export function AcademicHistory({
  results,
  fees,
  attendance,
  gradePoints,
}: {
  results: ResultRow[];
  fees: FeeRow[];
  attendance: AttendanceRow[];
  /** School's letter -> points map; omitted falls back to the fixed scale. */
  gradePoints?: Record<string, number>;
}) {
  const periodKeys = new Map<string, { session: string; term: string }>();
  for (const r of results) periodKeys.set(`${r.session}|${r.term}`, { session: r.session, term: r.term });
  for (const f of fees) periodKeys.set(`${f.session}|${f.term}`, { session: f.session, term: f.term });
  const periods = sortPeriodsDesc(Array.from(periodKeys.values()));

  const present = attendance.filter((a) => a.status === "present").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const late = attendance.filter((a) => a.status === "late").length;
  const total = attendance.length;
  const rate = total ? Math.round((present / total) * 100) : null;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Attendance (all-time)</h2>
        {rate === null ? (
          <p className="text-sm text-zinc-400">No attendance recorded yet.</p>
        ) : (
          <p className="text-2xl font-bold text-zinc-900">
            {rate}%{" "}
            <span className="text-sm font-normal text-zinc-400">
              present ({present} present · {absent} absent · {late} late of {total} days)
            </span>
          </p>
        )}
      </section>

      {periods.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No results or fee records yet.
        </p>
      ) : (
        periods.map(({ session, term }) => {
          const termResults = results.filter((r) => r.session === session && r.term === term);
          const termFees = fees.filter((f) => f.session === session && f.term === term);
          const gpa = computeGPA(termResults, gradePoints);

          return (
            <section
              key={`${session}|${term}`}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {session} · {TERM_LABELS[term as Term] ?? `Term ${term}`}
                </h2>
                {gpa !== null && (
                  <span className="text-xs font-medium text-zinc-500">GPA: {gpa.toFixed(2)}/5</span>
                )}
              </div>

              {termResults.length > 0 && (
                <table className="mb-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                      <th className="py-1 font-medium">Subject</th>
                      <th className="py-1 text-right font-medium">Total</th>
                      <th className="py-1 text-right font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {termResults.map((r) => (
                      <tr key={r.subject}>
                        <td className="py-1.5 text-zinc-900">{r.subject}</td>
                        <td className="py-1.5 text-right text-zinc-500">{r.total}/100</td>
                        <td className="py-1.5 text-right font-medium text-zinc-900">{r.grade ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {termFees.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                      <th className="py-1 font-medium">Fee type</th>
                      <th className="py-1 text-right font-medium">Expected</th>
                      <th className="py-1 text-right font-medium">Paid</th>
                      <th className="py-1 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {termFees.map((f) => (
                      <tr key={f.fee_type_name}>
                        <td className="py-1.5 text-zinc-900">{f.fee_type_name}</td>
                        <td className="py-1.5 text-right text-zinc-500">{naira(f.amount_expected)}</td>
                        <td className="py-1.5 text-right text-zinc-500">{naira(f.amount_paid)}</td>
                        <td className="py-1.5 text-right font-medium capitalize text-zinc-900">
                          {f.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
