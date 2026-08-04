import Link from "next/link";
import { fetchAllRows, fetchAllRowsByIds } from "@/lib/fetchAll";
import { requirePermission } from "@/lib/current-user";
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

interface DebtorLine {
  fee_record_id: string;
  fee_type_name: string;
  session: string;
  term: string;
  balance: number;
  days: number;
  bucket: BucketKey;
}

interface DebtorStudent {
  student_id: string;
  student: {
    id: string;
    full_name: string;
    class_id: string | null;
    parent_name: string | null;
    parent_phone: string | null;
  };
  className: string;
  totalBalance: number;
  // The oldest of this student's outstanding fee types drives their bucket —
  // the most conservative signal of how long they've genuinely been owing
  // something, not an average across fee types billed on different days.
  oldestDays: number;
  bucket: BucketKey;
  lines: DebtorLine[];
}

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; class?: string }>;
}) {
  const { profile } = await requirePermission("fees");
  const { bucket: bucketFilter, class: classFilter } = await searchParams;
  const supabase = await createClient();

  // Every unpaid balance, not just the current term — an unpaid 1st-term fee
  // is exactly what an aging report exists to surface. Read in full: a
  // debtors list that stops at the first page hides exactly the debts the
  // school opened the page to find.
  const [outstanding, { data: classes }, { data: campuses }] = await Promise.all([
    fetchAllRows<{
      fee_record_id: string;
      student_id: string;
      session: string;
      term: string;
      fee_type_name: string;
      amount_expected: number;
      amount_paid: number;
      balance: number;
    }>((from, to) =>
      supabase
        .from("fee_summary")
        .select(
          "fee_record_id, student_id, session, term, fee_type_name, amount_expected, amount_paid, balance"
        )
        .eq("school_id", profile.school_id ?? "")
        .gt("balance", 0)
        .order("fee_record_id")
        .range(from, to)
    ),
    supabase.from("classes").select("id, name, campus_id").order("name"),
    supabase.from("campuses").select("id, name").eq("school_id", profile.school_id ?? "").order("name"),
  ]);

  // Two classes can share a name — usually one per campus — so the filter
  // buttons need to tell them apart, or two identically-labelled buttons
  // sit side by side with no way to know which is which.
  const campusNameById = new Map((campuses ?? []).map((c) => [c.id, c.name]));
  const classNameCounts = new Map<string, number>();
  for (const c of classes ?? []) {
    const key = c.name.trim().toLowerCase();
    classNameCounts.set(key, (classNameCounts.get(key) ?? 0) + 1);
  }
  const classFilterLabel = (c: { name: string; campus_id: string | null }) => {
    const key = c.name.trim().toLowerCase();
    if ((classNameCounts.get(key) ?? 0) <= 1) return c.name;
    const campusName = c.campus_id ? campusNameById.get(c.campus_id) : null;
    return `${c.name} (${campusName ?? "No campus"})`;
  };

  const recordIds = outstanding.map((f) => f.fee_record_id);
  const studentIds = Array.from(new Set(outstanding.map((f) => f.student_id)));

  const [feeRecords, students] = await Promise.all([
    fetchAllRowsByIds<{ id: string; created_at: string }>(recordIds, (chunk, from, to) =>
      supabase.from("fee_records").select("id, created_at").in("id", chunk).order("id").range(from, to)
    ),
    fetchAllRowsByIds<{
      id: string;
      full_name: string;
      class_id: string | null;
      parent_name: string | null;
      parent_phone: string | null;
    }>(studentIds, (chunk, from, to) =>
      supabase
        .from("students")
        .select("id, full_name, class_id, parent_name, parent_phone")
        .in("id", chunk)
        .order("id")
        .range(from, to)
    ),
  ]);

  const billedAtById = new Map(feeRecords.map((r) => [r.id, r.created_at]));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const today = new Date();

  // Every fee type a student owes on (Tuition, Transport, Hostel, ...) is a
  // line item on that one student's bill, not a separate debtor — group by
  // student before doing anything else, the same way the fees list and the
  // student fee page already do.
  const studentMap = new Map<string, DebtorStudent>();
  for (const f of outstanding) {
    const student = studentById.get(f.student_id);
    if (!student) continue; // a fee record whose student was deleted has nothing to chase

    const billedAt = billedAtById.get(f.fee_record_id);
    const days = billedAt ? daysBetween(billedAt, today) : 0;
    const bucket = bucketFor(days);
    const balance = Number(f.balance);

    const line: DebtorLine = {
      fee_record_id: f.fee_record_id,
      fee_type_name: f.fee_type_name,
      session: f.session,
      term: f.term,
      balance,
      days,
      bucket,
    };

    const existing = studentMap.get(f.student_id);
    if (existing) {
      existing.totalBalance += balance;
      existing.lines.push(line);
      if (days > existing.oldestDays) {
        existing.oldestDays = days;
        existing.bucket = bucket;
      }
    } else {
      studentMap.set(f.student_id, {
        student_id: f.student_id,
        student,
        className: student.class_id ? classNameById.get(student.class_id) ?? "—" : "—",
        totalBalance: balance,
        oldestDays: days,
        bucket,
        lines: [line],
      });
    }
  }

  const studentRows = Array.from(studentMap.values()).sort((a, b) => b.oldestDays - a.oldestDays);

  const totals = new Map<BucketKey, { amount: number; count: number }>(
    BUCKETS.map((b) => [b.key, { amount: 0, count: 0 }])
  );
  for (const s of studentRows) {
    const t = totals.get(s.bucket)!;
    t.amount += s.totalBalance;
    t.count++;
  }
  const grandTotal = studentRows.reduce((sum, s) => sum + s.totalBalance, 0);

  const visible = studentRows.filter(
    (s) =>
      (bucketFilter ? s.bucket === bucketFilter : true) &&
      (classFilter ? s.student.class_id === classFilter : true)
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
            {naira(grandTotal)} outstanding across {studentRows.length}{" "}
            {studentRows.length === 1 ? "student" : "students"}, aged from the oldest fee each one
            owes.
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
                {t.count} {t.count === 1 ? "student" : "students"}
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
            label={classFilterLabel(c)}
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
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Balance</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Age</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Parent</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((s) => (
                <tr
                  key={s.student_id}
                  data-search-row={`${s.student.full_name} ${s.className} ${
                    s.student.parent_name ?? ""
                  } ${s.student.parent_phone ?? ""}`}
                >
                  <td colSpan={6} className="p-0">
                    <details className="group">
                      <summary className="grid cursor-pointer list-none grid-cols-[1.6fr_0.9fr_1fr_0.6fr_1.3fr_0.8fr] items-center gap-2 px-4 py-2 marker:hidden hover:bg-zinc-50">
                        <span className="font-medium text-zinc-900">
                          <Link href={`/students/${s.student_id}`} className="hover:underline">
                            {s.student.full_name}
                          </Link>
                        </span>
                        <span className="text-zinc-500">{s.className}</span>
                        <span className="text-right font-medium text-zinc-900">
                          {naira(s.totalBalance)}
                        </span>
                        <span
                          className={`text-right font-medium ${
                            BUCKETS.find((b) => b.key === s.bucket)!.tone
                          }`}
                        >
                          {s.oldestDays}d
                        </span>
                        <span className="text-zinc-500">
                          <span className="block leading-tight">
                            {s.student.parent_name ?? "—"}
                          </span>
                          {s.student.parent_phone && (
                            <span className="block text-xs text-zinc-400">
                              {s.student.parent_phone}
                            </span>
                          )}
                        </span>
                        <span className="text-right text-xs text-zinc-400">
                          <span className="group-open:hidden">
                            {s.lines.length} {s.lines.length === 1 ? "fee" : "fees"} · Details ▾
                          </span>
                          <span className="hidden group-open:inline">Close ▴</span>
                        </span>
                      </summary>
                      <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/50 px-4 py-4">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="text-left text-zinc-400">
                              <th className="pb-1 pr-4 font-medium">Fee type</th>
                              <th className="pb-1 pr-4 font-medium">Session / Term</th>
                              <th className="pb-1 pr-4 text-right font-medium">Balance</th>
                              <th className="pb-1 text-right font-medium">Age</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {s.lines.map((l) => (
                              <tr key={l.fee_record_id}>
                                <td className="py-1 pr-4 text-zinc-700">{l.fee_type_name}</td>
                                <td className="py-1 pr-4 text-zinc-500">
                                  {l.session} · {TERM_LABELS[l.term as Term]}
                                </td>
                                <td className="py-1 pr-4 text-right text-zinc-900">
                                  {naira(l.balance)}
                                </td>
                                <td
                                  className={`py-1 text-right font-medium ${
                                    BUCKETS.find((b) => b.key === l.bucket)!.tone
                                  }`}
                                >
                                  {l.days}d
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Link
                          href={`/fees/student/${s.student_id}`}
                          className="inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900"
                        >
                          Manage fees →
                        </Link>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    {studentRows.length === 0
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
