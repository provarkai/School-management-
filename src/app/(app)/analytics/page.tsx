import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  getAcademicTrend,
  getAttendanceTrend,
  getFinancialTrend,
  getProfitAndLoss,
} from "@/lib/analytics";
import { naira } from "@/lib/format";
import { BarChart } from "@/components/BarChart";

export default async function AnalyticsPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();
  const schoolId = profile.school_id ?? "";

  const [financial, academic, attendance, profitAndLoss] = await Promise.all([
    getFinancialTrend(supabase, schoolId),
    getAcademicTrend(supabase, schoolId),
    getAttendanceTrend(supabase, schoolId),
    getProfitAndLoss(supabase, schoolId),
  ]);

  const plTotals = profitAndLoss.reduce(
    (acc, p) => {
      acc.income += p.income;
      acc.expenses += p.expenses;
      acc.payroll += p.payroll;
      acc.net += p.net;
      return acc;
    },
    { income: 0, expenses: 0, payroll: 0, net: 0 }
  );
  const hasPlActivity = plTotals.income > 0 || plTotals.expenses > 0 || plTotals.payroll > 0;

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
        <h2 className="text-sm font-semibold text-zinc-900">Profit &amp; loss (last 12 months)</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Money actually received against money actually spent. Salaries only count once a
          payroll run is marked paid.
        </p>
        {!hasPlActivity ? (
          <p className="text-sm text-zinc-400">No payments or expenses recorded yet.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Income" value={naira(plTotals.income)} tone="text-emerald-600" />
              <Stat label="Expenses" value={naira(plTotals.expenses)} tone="text-zinc-900" />
              <Stat label="Salaries" value={naira(plTotals.payroll)} tone="text-zinc-900" />
              <Stat
                label="Net"
                value={naira(plTotals.net)}
                tone={plTotals.net < 0 ? "text-red-600" : "text-emerald-600"}
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                    <th className="py-1 font-medium">Month</th>
                    <th className="py-1 text-right font-medium">Income</th>
                    <th className="py-1 text-right font-medium">Expenses</th>
                    <th className="py-1 text-right font-medium">Salaries</th>
                    <th className="py-1 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {profitAndLoss.map((p) => (
                    <tr key={p.key}>
                      <td className="py-1.5 whitespace-nowrap text-zinc-900">{p.label}</td>
                      <td className="py-1.5 text-right text-zinc-500">{naira(p.income)}</td>
                      <td className="py-1.5 text-right text-zinc-500">{naira(p.expenses)}</td>
                      <td className="py-1.5 text-right text-zinc-500">{naira(p.payroll)}</td>
                      <td
                        className={`py-1.5 text-right font-medium ${
                          p.net < 0 ? "text-red-600" : "text-zinc-900"
                        }`}
                      >
                        {naira(p.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 text-sm font-semibold">
                    <td className="py-2 text-zinc-900">Total</td>
                    <td className="py-2 text-right text-zinc-900">{naira(plTotals.income)}</td>
                    <td className="py-2 text-right text-zinc-900">{naira(plTotals.expenses)}</td>
                    <td className="py-2 text-right text-zinc-900">{naira(plTotals.payroll)}</td>
                    <td
                      className={`py-2 text-right ${
                        plTotals.net < 0 ? "text-red-600" : "text-emerald-600"
                      }`}
                    >
                      {naira(plTotals.net)}
                    </td>
                  </tr>
                </tfoot>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {academic.map((a) => (
                    <tr key={a.label}>
                      <td className="py-1.5 text-zinc-900">{a.label}</td>
                      <td className="py-1.5 text-right font-medium text-zinc-900">
                        {a.averageScore.toFixed(1)}%
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

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}
