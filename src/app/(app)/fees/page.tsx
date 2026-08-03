import Link from "next/link";
import { fetchAllRows } from "@/lib/fetchAll";
import { requirePermission } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import type { FeeStatus } from "@/lib/types";
import { ExportLinks } from "@/components/ExportLinks";
import { TableSearch } from "@/components/TableSearch";
import { FeeTypesManager } from "./FeeTypesManager";
import { SetClassFeeForm } from "./SetClassFeeForm";

const STATUS_STYLES: Record<FeeStatus | "unset", string> = {
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  owing: "bg-red-100 text-red-700",
  unset: "bg-zinc-100 text-zinc-500",
};

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; status?: string; type?: string }>;
}) {
  const { profile, school } = await requirePermission("fees");
  const { class: classFilter, status: statusFilter, type: typeParam } = await searchParams;
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: classes }, { data: feeTypes }, studentsQuery] = await Promise.all([
    supabase.from("classes").select("id, name").order("name"),
    supabase
      .from("fee_types")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    (async () => {
      let query = supabase
        .from("students")
        .select("id, full_name, class_id")
        .eq("status", "active")
        .order("full_name");
      if (classFilter) query = query.eq("class_id", classFilter);
      return query;
    })(),
  ]);

  const typeFilter = typeParam === "all" ? null : typeParam || feeTypes?.[0]?.id || null;

  // One row per student per fee type — a few hundred students already
  // exceeds what a single request returns, and the missing rows would
  // silently show as "not set" against those students.
  const feeSummaries = await fetchAllRows<{
    student_id: string;
    fee_type_id: string;
    amount_expected: number;
    amount_paid: number;
    balance: number;
    status: string;
  }>((from, to) => {
    let query = supabase
      .from("fee_summary")
      .select("student_id, fee_type_id, amount_expected, amount_paid, balance, status")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", term);
    if (typeFilter) query = query.eq("fee_type_id", typeFilter);
    return query.order("fee_record_id").range(from, to);
  });

  const { data: students } = studentsQuery;
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  // typeFilter set: one row per student (that fee type). No filter ("all"):
  // combine every fee type into a single expected/paid/balance total per
  // student, with status derived from the combined balance.
  const feeByStudent = new Map<
    string,
    { amount_expected: number; amount_paid: number; balance: number; status: FeeStatus }
  >();
  for (const f of feeSummaries) {
    const existing = feeByStudent.get(f.student_id);
    if (!existing) {
      feeByStudent.set(f.student_id, {
        amount_expected: Number(f.amount_expected),
        amount_paid: Number(f.amount_paid),
        balance: Number(f.balance),
        status: f.status as FeeStatus,
      });
    } else {
      existing.amount_expected += Number(f.amount_expected);
      existing.amount_paid += Number(f.amount_paid);
      existing.balance += Number(f.balance);
    }
  }
  for (const fee of feeByStudent.values()) {
    fee.status = fee.balance <= 0 ? "paid" : fee.amount_paid > 0 ? "partial" : "owing";
  }

  const rows = (students ?? [])
    .map((s) => ({ student: s, fee: feeByStudent.get(s.id) }))
    .filter((row) => (statusFilter ? (row.fee?.status ?? "unset") === statusFilter : true));

  const totals = rows.reduce(
    (acc, r) => {
      acc.expected += r.fee?.amount_expected ?? 0;
      acc.paid += r.fee?.amount_paid ?? 0;
      return acc;
    },
    { expected: 0, paid: 0 }
  );

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { class: classFilter, status: statusFilter, type: typeParam, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/fees?${qs}` : "/fees";
  };

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
          <ExportLinks
            baseUrl="/fees/export"
            params={{
              ...(classFilter ? { class: classFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(typeFilter ? { type: typeFilter } : {}),
            }}
            formats={[
              { format: "csv", label: "CSV" },
              { format: "xlsx", label: "Excel" },
            ]}
          />
          <a
            href={`/fees/pdf?${new URLSearchParams({
              ...(classFilter ? { class: classFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(typeFilter ? { type: typeFilter } : {}),
            }).toString()}`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Download PDF
          </a>
          <Link
            href="/fees/transfers"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Bank transfers
          </Link>
        </div>
      </div>

      <FeeTypesManager feeTypes={feeTypes ?? []} />
      <SetClassFeeForm classes={classes ?? []} feeTypes={feeTypes ?? []} />

      {(feeTypes ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Fee type:
          </span>
          <FilterLink label="All (combined)" href={query({ type: "all" })} active={typeParam === "all"} />
          {(feeTypes ?? []).map((t) => (
            <FilterLink
              key={t.id}
              label={t.name}
              href={query({ type: t.id })}
              active={typeFilter === t.id && typeParam !== "all"}
            />
          ))}
        </div>
      )}

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
        <span className="mx-1 text-zinc-300">|</span>
        <FilterLink label="Owing" href={query({ status: "owing" })} active={statusFilter === "owing"} />
        <FilterLink label="Partial" href={query({ status: "partial" })} active={statusFilter === "partial"} />
        <FilterLink label="Paid" href={query({ status: "paid" })} active={statusFilter === "paid"} />
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search students…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
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
              const cls = student.class_id ? classNameById.get(student.class_id) ?? "—" : "—";
              return (
                <tr key={student.id} data-search-row={`${student.full_name} ${cls}`}>
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    <Link href={`/students/${student.id}`} className="hover:underline">
                      {student.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{cls}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {fee ? naira(fee.amount_expected) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {fee ? naira(fee.amount_paid) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-zinc-900">
                    {fee ? naira(fee.balance) : "—"}
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
