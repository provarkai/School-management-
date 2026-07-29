import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getAcademicTrend, getAttendanceTrend, getFinancialTrend } from "@/lib/analytics";
import { naira } from "@/lib/format";
import { BarChart } from "@/components/BarChart";

export default async function AnalyticsPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();
  const schoolId = profile.school_id ?? "";

  const [financial, academic, attendance] = await Promise.all([
    getFinancialTrend(supabase, schoolId),
    getAcademicTrend(supabase, schoolId),
    getAttendanceTrend(supabase, schoolId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Analytics</h1>
        <p className="text-sm text-zinc-500">
          Trends across every session and term on record — not just the current one.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Fee collections by term</h2>
        {financial.length === 0 ? (
          <p className="text-sm text-zinc-400">No fee records yet.</p>
        ) : (
          <>
            <BarChart
              points={financial.map((f) => ({ label: f.label, value: f.collected }))}
              formatValue={(v) => naira(v)}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                    <th className="py-1 font-medium">Term</th>
                    <th className="py-1 text-right font-medium">Expected</th>
                    <th className="py-1 text-right font-medium">Collected</th>
                    <th className="py-1 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {financial.map((f) => (
                    <tr key={f.label}>
                      <td className="py-1.5 text-zinc-900">{f.label}</td>
                      <td className="py-1.5 text-right text-zinc-500">{naira(f.expected)}</td>
                      <td className="py-1.5 text-right text-zinc-500">{naira(f.collected)}</td>
                      <td className="py-1.5 text-right font-medium text-zinc-900">
                        {f.expected > 0 ? `${Math.round((f.collected / f.expected) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Academic performance by term</h2>
        {academic.length === 0 ? (
          <p className="text-sm text-zinc-400">No results entered yet.</p>
        ) : (
          <>
            <BarChart
              points={academic.map((a) => ({ label: a.label, value: a.averageScore }))}
              formatValue={(v) => `${v.toFixed(0)}%`}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                    <th className="py-1 font-medium">Term</th>
                    <th className="py-1 text-right font-medium">Average score</th>
                    <th className="py-1 text-right font-medium">Average GPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {academic.map((a) => (
                    <tr key={a.label}>
                      <td className="py-1.5 text-zinc-900">{a.label}</td>
                      <td className="py-1.5 text-right text-zinc-500">{a.averageScore.toFixed(1)}%</td>
                      <td className="py-1.5 text-right font-medium text-zinc-900">
                        {a.gpa !== null ? `${a.gpa.toFixed(2)}/5` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Attendance rate by month</h2>
        <BarChart
          points={attendance.map((a) => ({ label: a.label, value: a.rate }))}
          formatValue={(v) => `${v}%`}
        />
      </section>
    </div>
  );
}
