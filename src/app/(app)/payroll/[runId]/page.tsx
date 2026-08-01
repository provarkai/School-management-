import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { EntryDeductions } from "./EntryDeductions";
import { MarkPaidButton } from "./MarkPaidButton";

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id, period, status, paid_at")
    .eq("id", runId)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!run) notFound();

  const [{ data: entries }, { data: deductionTypes }, { data: deductionRows }] = await Promise.all([
    supabase
      .from("payroll_entries")
      .select("id, staff_id, base_salary, deductions, net_pay, app_users(name)")
      .eq("payroll_run_id", runId)
      .order("created_at"),
    supabase
      .from("deduction_types")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("payroll_entry_deductions")
      .select("id, amount, payroll_entry_id, deduction_types(name)")
      .eq("school_id", profile.school_id ?? ""),
  ]);

  const lineItemsByEntry = new Map<string, { id: string; amount: number; typeName: string }[]>();
  for (const row of deductionRows ?? []) {
    const list = lineItemsByEntry.get(row.payroll_entry_id) ?? [];
    list.push({
      id: row.id,
      amount: Number(row.amount),
      typeName: (row.deduction_types as unknown as { name: string } | null)?.name ?? "—",
    });
    lineItemsByEntry.set(row.payroll_entry_id, list);
  }

  const rows = (entries ?? []).map((e) => ({
    ...e,
    staffName: (e.app_users as unknown as { name: string } | null)?.name ?? "—",
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.base += Number(r.base_salary);
      acc.deductions += Number(r.deductions);
      acc.net += Number(r.net_pay);
      return acc;
    },
    { base: 0, deductions: 0, net: 0 }
  );

  const editable = run.status === "draft";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/payroll" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← Payroll
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Payroll — {run.period}</h1>
        <p className="text-sm text-zinc-500">
          {run.status === "paid" ? `Paid on ${run.paid_at?.slice(0, 10)}` : "Draft — deductions can still be edited"}
        </p>
      </div>

      {editable && (deductionTypes ?? []).length === 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No deduction types set up yet —{" "}
          <Link href="/payroll" className="font-medium underline">
            add some on the Payroll page
          </Link>{" "}
          before recording deductions here.
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <SummaryStat label="Total base" value={naira(totals.base)} />
        <SummaryStat label="Total deductions" value={naira(totals.deductions)} />
        <SummaryStat label="Total net pay" value={naira(totals.net)} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No staff have a salary set yet — add one from the Payroll page.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-900">{entry.staffName}</p>
                <p className="text-sm text-zinc-500">
                  Base {naira(Number(entry.base_salary))} · Net{" "}
                  <span className="font-medium text-zinc-900">{naira(Number(entry.net_pay))}</span>
                </p>
              </div>
              <EntryDeductions
                entryId={entry.id}
                runId={run.id}
                editable={editable}
                lineItems={lineItemsByEntry.get(entry.id) ?? []}
                deductionTypes={deductionTypes ?? []}
              />
            </div>
          ))}
        </div>
      )}

      {editable && rows.length > 0 && <MarkPaidButton runId={run.id} />}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-zinc-900">{value}</p>
    </div>
  );
}
