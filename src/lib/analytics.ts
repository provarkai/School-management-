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

  const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

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
