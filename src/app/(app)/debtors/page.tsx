import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";
import { TableSearch } from "@/components/TableSearch";

// Aging runs from the day the bill was raised (fee_records.created_at) —
// there is no separate due date in the schema, and in practice a Nigerian
// school's fee is due from the day it is announced.
const BUCKETS = [
  { key: "0-30", label: "0–30 days", min: 0, max: 30, tone: "text-zinc-900" },
  { key: "31-60", label: "31–60 days", min: 31, max: 60, tone: "text-amber-600" },
  { key: "61-90", label: "61–90 days", min: 61, max: 90, tone: "text-orange-600" },
  { key: "90+", label: "Over 90 days", min: 91, max: Infinity, tone: "text-red-600" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

function bucketFor(days: number): BucketKey {
  return BUCKETS.find((b) => days >= b.min && days <= b.max)!.key;
}

function daysBetween(from: string, to: Date): number {
  const ms = to.getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; class?: string }>;
}) {
  const { profile } = await requireProprietor();
  const { bucket: bucketFilter, class: classFilter } = await searchParams;
  const supabase = await createClient();

  // Every unpaid balance, not just the current term — an unpaid 1st-term fee
  // is exactly what an aging report exists to surface.
  const [{ data: outstanding }, { data: classes }] = await Promise.all([
    supabase
      .from("fee_summary")
      .select(
        "fee_record_id, student_id, session, term, fee_type_name, amount_expected, amount_paid, balance"
      )
      .eq("school_id", profile.school_id ?? "")
      .gt("balance", 0),
    supabase.from("classes").select("id, name").order("name"),
  ]);

  const recordIds = (outstanding ?? []).map((f) => f.fee_record_id);
  const studentIds = Array.from(new Set((outstanding ?? []).map((f) => f.student_id)));

  const [{ data: feeRecords }, { data: students }] = await Promise.all([
    recordIds.length > 0
      ? supabase.from("fee_records").select("id, created_at").in("id", recordIds)
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase
          .from("students")
          .select("id, full_name, class_id, parent_name, parent_phone")
          .in("id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const billedAtById = new Map((feeRecords ?? []).map((r) => [r.id, r.created_at]));
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const today = new Date();

  const rows = (outstanding ?? [])
    .map((f) => {
      const student = studentById.get(f.student_id);
      const billedAt = billedAtById.get(f.fee_record_id);
      const days = billedAt ? daysBetween(billedAt, today) : 0;
      return {
        ...f,
        balance: Number(f.balance),
        amount_expected: Number(f.amount_expected),
        amount_paid: Number(f.amount_paid),
        student,
        className: student?.class_id ? classNameById.get(student.class_id) ?? "—" : "—",
        days,
        bucket: bucketFor(days),
      };
    })
    // A fee record whose student was deleted has nothing to chase.
    .filter((r) => r.student)
    .sort((a, b) => b.days - a.days);

  const totals = new Map<BucketKey, { amount: number; count: number }>(
    BUCKETS.map((b) => [b.key, { amount: 0, count: 0 }])
  );
  for (const r of rows) {
    const t = totals.get(r.bucket)!;
    t.amount += r.balance;
    t.count++;
  }
  const grandTotal = rows.reduce((sum, r) => sum + r.balance, 0);

  const visible = rows.filter(
    (r) =>
      (bucketFilter ? r.bucket === bucketFilter : true) &&
      (classFilter ? r.student?.class_id === classFilter : true)
  );

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { bucket: bucketFilter, class: classFilter, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/debtors?${qs}` : "/debtors";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Debtors</h1>
          <p className="text-sm text-zinc-500">
            {naira(grandTotal)} outstanding across {rows.length}{" "}
            {rows.length === 1 ? "unpaid fee" : "unpaid fees"}, aged from the day each fee was
            raised.
          </p>
        </div>
        <Link
          href="/reminders"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Send reminders
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((b) => {
          const t = totals.get(b.key)!;
          const active = bucketFilter === b.key;
          return (
            <Link
              key={b.key}
              href={query({ bucket: active ? undefined : b.key })}
              className={`rounded-lg border bg-white p-4 shadow-sm transition hover:border-zinc-400 ${
                active ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {b.label}
              </p>
              <p className={`mt-1 text-xl font-bold ${b.tone}`}>{naira(t.amount)}</p>
              <p className="text-xs text-zinc-400">
                {t.count} {t.count === 1 ? "fee" : "fees"}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterLink label="All classes" href={query({ class: undefined })} active={!classFilter} />
        {(classes ?? []).map((c) => (
          <FilterLink
            key={c.id}
            label={c.name}
            href={query({ class: c.id })}
            active={classFilter === c.id}
          />
        ))}
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search students…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Fee</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Term</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Balance</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Age</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Parent</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((r) => (
                <tr
                  key={r.fee_record_id}
                  data-search-row={`${r.student?.full_name ?? ""} ${r.className} ${
                    r.student?.parent_name ?? ""
                  } ${r.student?.parent_phone ?? ""}`}
                >
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    <Link href={`/students/${r.student_id}`} className="hover:underline">
                      {r.student?.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{r.className}</td>
                  <td className="px-4 py-2 text-zinc-500">{r.fee_type_name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {r.session} · {TERM_LABELS[r.term as Term]}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900">
                    {naira(r.balance)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      BUCKETS.find((b) => b.key === r.bucket)!.tone
                    }`}
                  >
                    {r.days}d
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    <div className="leading-tight">
                      <span className="block">{r.student?.parent_name ?? "—"}</span>
                      {r.student?.parent_phone && (
                        <span className="block text-xs text-zinc-400">
                          {r.student.parent_phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/fees/student/${r.student_id}`}
                      className="font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                    {rows.length === 0
                      ? "No outstanding balances. Everyone is paid up."
                      : "No debtors match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {label}
    </Link>
  );
}
