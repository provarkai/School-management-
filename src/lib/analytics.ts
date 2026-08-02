import type { createClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface PeriodKey {
  session: string;
  term: Term;
}

function periodLabel(p: PeriodKey): string {
  return `${p.session} T${p.term}`;
}

function sortPeriodsAsc<T extends PeriodKey>(keys: T[]): T[] {
  return [...keys].sort((a, b) => {
    if (a.session !== b.session) return a.session.localeCompare(b.session);
    return Number(a.term) - Number(b.term);
  });
}

export interface FinancialTrendPoint {
  label: string;
  expected: number;
  collected: number;
}

export async function getFinancialTrend(
  supabase: SupabaseClient,
  schoolId: string
): Promise<FinancialTrendPoint[]> {
  const { data } = await supabase
    .from("fee_summary")
    .select("session, term, amount_expected, amount_paid")
    .eq("school_id", schoolId);

  const byPeriod = new Map<string, FinancialTrendPoint & PeriodKey>();
  for (const row of data ?? []) {
    const key = `${row.session}|${row.term}`;
    const existing = byPeriod.get(key);
    if (existing) {
      existing.expected += Number(row.amount_expected);
      existing.collected += Number(row.amount_paid);
    } else {
      byPeriod.set(key, {
        session: row.session,
        term: row.term as Term,
        label: periodLabel({ session: row.session, term: row.term as Term }),
        expected: Number(row.amount_expected),
        collected: Number(row.amount_paid),
      });
    }
  }

  return sortPeriodsAsc(Array.from(byPeriod.values()));
}

export interface ProfitAndLossPoint {
  /** "YYYY-MM" */
  key: string;
  label: string;
  income: number;
  expenses: number;
  payroll: number;
  net: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Cash-basis profit and loss, by calendar month.
 *
 * Deliberately monthly rather than per term: payroll runs are keyed to a
 * month ("2026-03") with no term attached, and there is no stored mapping
 * from a month to a term, so a per-term P&L would have to guess where each
 * salary run belongs. Money in is what was actually received (fee payment
 * dates), money out is what was actually spent — recorded expenses plus the
 * net pay on payroll runs already marked paid.
 */
export async function getProfitAndLoss(
  supabase: SupabaseClient,
  schoolId: string,
  months = 12
): Promise<ProfitAndLossPoint[]> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const sinceDate = since.toISOString().slice(0, 10);
  const sinceMonth = sinceDate.slice(0, 7);

  const [{ data: payments }, { data: expenses }, { data: runs }] = await Promise.all([
    supabase
      .from("fee_payments")
      .select("amount, payment_date")
      .eq("school_id", schoolId)
      .gte("payment_date", sinceDate),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("school_id", schoolId)
      .gte("expense_date", sinceDate),
    supabase
      .from("payroll_runs")
      .select("id, period")
      .eq("school_id", schoolId)
      .eq("status", "paid")
      .gte("period", sinceMonth),
  ]);

  // A draft run hasn't cost the school anything yet, so only paid runs are
  // fetched above and only their entries are summed here.
  const runIds = (runs ?? []).map((r) => r.id);
  const { data: entries } =
    runIds.length > 0
      ? await supabase
          .from("payroll_entries")
          .select("payroll_run_id, net_pay")
          .in("payroll_run_id", runIds)
      : { data: [] };

  const periodByRun = new Map((runs ?? []).map((r) => [r.id, r.period]));

  const buckets: ProfitAndLossPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      income: 0,
      expenses: 0,
      payroll: 0,
      net: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const p of payments ?? []) {
    const bucket = byKey.get(p.payment_date.slice(0, 7));
    if (bucket) bucket.income += Number(p.amount);
  }
  for (const e of expenses ?? []) {
    const bucket = byKey.get(e.expense_date.slice(0, 7));
    if (bucket) bucket.expenses += Number(e.amount);
  }
  for (const entry of entries ?? []) {
    const period = periodByRun.get(entry.payroll_run_id);
    const bucket = period ? byKey.get(period) : undefined;
    if (bucket) bucket.payroll += Number(entry.net_pay);
  }

  for (const b of buckets) {
    b.net = b.income - b.expenses - b.payroll;
  }

  return buckets;
}

export interface AcademicTrendPoint {
  label: string;
  averageScore: number;
}

export async function getAcademicTrend(
  supabase: SupabaseClient,
  schoolId: string
): Promise<AcademicTrendPoint[]> {
  const { data } = await supabase
    .from("results")
    .select("session, term, total, grade")
    .eq("school_id", schoolId);

  const byPeriod = new Map<
    string,
    PeriodKey & { totals: number[]; grades: { grade: string | null }[] }
  >();
  for (const row of data ?? []) {
    const key = `${row.session}|${row.term}`;
    const existing = byPeriod.get(key);
    if (existing) {
      existing.totals.push(Number(row.total));
      existing.grades.push({ grade: row.grade });
    } else {
      byPeriod.set(key, {
        session: row.session,
        term: row.term as Term,
        totals: [Number(row.total)],
        grades: [{ grade: row.grade }],
      });
    }
  }

  return sortPeriodsAsc(Array.from(byPeriod.values())).map((p) => {
    const entry = byPeriod.get(`${p.session}|${p.term}`)!;
    const averageScore = entry.totals.reduce((s, t) => s + t, 0) / entry.totals.length;
    return {
      label: periodLabel(p),
      averageScore,
    };
  });
}

export interface AttendanceTrendPoint {
  label: string;
  rate: number | null;
}

export async function getAttendanceTrend(
  supabase: SupabaseClient,
  schoolId: string,
  months = 12
): Promise<AttendanceTrendPoint[]> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data } = await supabase
    .from("attendance")
    .select("date, status")
    .eq("school_id", schoolId)
    .gte("date", since.toISOString().slice(0, 10));

  const buckets: { key: string; label: string; present: number; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      present: 0,
      total: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const row of data ?? []) {
    const key = row.date.slice(0, 7);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.total++;
    if (row.status === "present") bucket.present++;
  }

  return buckets.map((b) => ({
    label: b.label,
    rate: b.total ? Math.round((b.present / b.total) * 100) : null,
  }));
}
