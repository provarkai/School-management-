import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import type { FeeStatus } from "@/lib/types";

const STATUS_STYLES: Record<FeeStatus | "unset", string> = {
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  owing: "bg-red-100 text-red-700",
  unset: "bg-zinc-100 text-zinc-500",
};

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; status?: string }>;
}) {
  const { profile, school } = await requireProprietor();
  const { class: classFilter, status: statusFilter } = await searchParams;
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: classes }, studentsQuery, { data: feeSummaries }] = await Promise.all([
    supabase.from("classes").select("id, name").order("name"),
    (async () => {
      let query = supabase
        .from("students")
        .select("id, full_name, class_id")
        .eq("status", "active")
        .order("full_name");
      if (classFilter) query = query.eq("class_id", classFilter);
      return query;
    })(),
    supabase
      .from("fee_summary")
      .select("student_id, amount_expected, amount_paid, balance, status")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", term),
  ]);

  const { data: students } = studentsQuery;
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const feeByStudent = new Map((feeSummaries ?? []).map((f) => [f.student_id, f]));

  const rows = (students ?? [])
    .map((s) => ({ student: s, fee: feeByStudent.get(s.id) }))
    .filter((row) => (statusFilter ? (row.fee?.status ?? "unset") === statusFilter : true));

  const totals = rows.reduce(
    (acc, r) => {
      acc.expected += Number(r.fee?.amount_expected ?? 0);
      acc.paid += Number(r.fee?.amount_paid ?? 0);
      return acc;
    },
    { expected: 0, paid: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Fees</h1>
          <p className="text-sm text-zinc-500">
            {session} · Term {term} — {naira(totals.paid)} collected of {naira(totals.expected)}{" "}
            expected
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/fees/export?${new URLSearchParams({
              ...(classFilter ? { class: classFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
            }).toString()}`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Export CSV
          </a>
          <Link
            href="/fees/transfers"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Bank transfers
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterLink label="All classes" href="/fees" active={!classFilter && !statusFilter} />
        {(classes ?? []).map((c) => (
          <FilterLink
            key={c.id}
            label={c.name}
            href={`/fees?class=${c.id}`}
            active={classFilter === c.id}
          />
        ))}
        <span className="mx-1 text-zinc-300">|</span>
        <FilterLink
          label="Owing"
          href={`/fees?status=owing${classFilter ? `&class=${classFilter}` : ""}`}
          active={statusFilter === "owing"}
        />
        <FilterLink
          label="Partial"
          href={`/fees?status=partial${classFilter ? `&class=${classFilter}` : ""}`}
          active={statusFilter === "partial"}
        />
        <FilterLink
          label="Paid"
          href={`/fees?status=paid${classFilter ? `&class=${classFilter}` : ""}`}
          active={statusFilter === "paid"}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Expected</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Paid</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Balance</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map(({ student, fee }) => {
              const status = fee?.status ?? "unset";
              return (
                <tr key={student.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900">{student.full_name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {student.class_id ? classNameById.get(student.class_id) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {fee ? naira(Number(fee.amount_expected)) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {fee ? naira(Number(fee.amount_paid)) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900">
                    {fee ? naira(Number(fee.balance)) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status as FeeStatus | "unset"]}`}
                    >
                      {status === "unset" ? "not set" : status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/fees/student/${student.id}`}
                      className="font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  No students match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
