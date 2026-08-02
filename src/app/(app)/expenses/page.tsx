import Link from "next/link";
import { fetchAllRows } from "@/lib/fetchAll";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { ExportLinks } from "@/components/ExportLinks";
import { TableSearch } from "@/components/TableSearch";
import { CategoriesManager } from "./CategoriesManager";
import { AddExpenseForm } from "./AddExpenseForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; campus?: string }>;
}) {
  const { profile, school } = await requireProprietor();
  const { category: categoryFilter, campus: campusFilter } = await searchParams;
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: categories }, { data: campuses }, feeRows] = await Promise.all([
    supabase
      .from("expense_categories")
      .select("id, name, termly_budget")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("campuses")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    // One row per student per fee type: past a few hundred students this
    // is more than a single request returns, and a short read would
    // under-report collections against the budget.
    fetchAllRows<{ amount_paid: number }>((from, to) =>
      supabase
        .from("fee_summary")
        .select("amount_paid")
        .eq("school_id", profile.school_id ?? "")
        .eq("session", session)
        .eq("term", term)
        .order("fee_record_id")
        .range(from, to)
    ),
  ]);

  let expensesQuery = supabase
    .from("expenses")
    .select(
      "id, amount, expense_date, vendor, description, category_id, campus_id, expense_categories(name), campuses(name), app_users(name)"
    )
    .eq("school_id", profile.school_id ?? "")
    .eq("session", session)
    .eq("term", term)
    .order("expense_date", { ascending: false });
  if (categoryFilter) expensesQuery = expensesQuery.eq("category_id", categoryFilter);
  if (campusFilter) expensesQuery = expensesQuery.eq("campus_id", campusFilter);
  const { data: expenseRows } = await expensesQuery;

  type ExpenseRow = {
    id: string;
    amount: number;
    expense_date: string;
    vendor: string | null;
    description: string | null;
    category_id: string;
    campus_id: string | null;
    expense_categories: { name: string } | null;
    campuses: { name: string } | null;
    app_users: { name: string } | null;
  };
  const expenses = (expenseRows ?? []) as unknown as ExpenseRow[];

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const feesCollected = feeRows.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const netPosition = feesCollected - totalExpenses;

  const actualByCategory = new Map<string, number>();
  for (const e of expenses) {
    actualByCategory.set(e.category_id, (actualByCategory.get(e.category_id) ?? 0) + Number(e.amount));
  }

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { category: categoryFilter, campus: campusFilter, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/expenses?${qs}` : "/expenses";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Expenses</h1>
          <p className="text-sm text-zinc-500">
            {session} · Term {term}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportLinks
            baseUrl="/expenses/export"
            params={{
              ...(categoryFilter ? { category: categoryFilter } : {}),
              ...(campusFilter ? { campus: campusFilter } : {}),
            }}
            formats={[
              { format: "csv", label: "CSV" },
              { format: "xlsx", label: "Excel" },
            ]}
          />
          <a
            href={`/expenses/pdf?${new URLSearchParams({
              ...(categoryFilter ? { category: categoryFilter } : {}),
              ...(campusFilter ? { campus: campusFilter } : {}),
            }).toString()}`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Download PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Fees collected this term" value={naira(feesCollected)} />
        <SummaryCard label="Expenses this term" value={naira(totalExpenses)} />
        <SummaryCard
          label="Net position"
          value={naira(netPosition)}
          tone={netPosition >= 0 ? "positive" : "negative"}
        />
      </div>

      <CategoriesManager categories={categories ?? []} />

      {(categories ?? []).some((c) => c.termly_budget !== null) && (
        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Category</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Budget</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Actual</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(categories ?? [])
                .filter((c) => c.termly_budget !== null)
                .map((c) => {
                  const actual = actualByCategory.get(c.id) ?? 0;
                  const budget = Number(c.termly_budget);
                  const remaining = budget - actual;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2 font-medium text-zinc-900">{c.name}</td>
                      <td className="px-4 py-2 text-right text-zinc-500">{naira(budget)}</td>
                      <td className="px-4 py-2 text-right text-zinc-500">{naira(actual)}</td>
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          remaining < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {naira(remaining)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}

      <AddExpenseForm categories={categories ?? []} campuses={campuses ?? []} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={query({ category: undefined })}
          className={`rounded-full px-3 py-1 ${
            !categoryFilter ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          All categories
        </Link>
        {(categories ?? []).map((c) => (
          <Link
            key={c.id}
            href={query({ category: c.id })}
            className={`rounded-full px-3 py-1 ${
              categoryFilter === c.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search expenses…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Date</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Category</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Vendor / Note</th>
              {(campuses ?? []).length > 0 && (
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Campus</th>
              )}
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Amount</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Recorded by</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {expenses.map((e) => (
              <tr
                key={e.id}
                data-search-row={[
                  e.expense_date,
                  e.expense_categories?.name,
                  e.vendor,
                  e.description,
                  e.campuses?.name,
                  e.app_users?.name,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <td className="px-4 py-2 text-zinc-500">{e.expense_date}</td>
                <td className="px-4 py-2 font-medium text-zinc-900">
                  {e.expense_categories?.name ?? "—"}
                </td>
                <td className="px-4 py-2 text-zinc-500">
                  {[e.vendor, e.description].filter(Boolean).join(" — ") || "—"}
                </td>
                {(campuses ?? []).length > 0 && (
                  <td className="px-4 py-2 text-zinc-500">{e.campuses?.name ?? "—"}</td>
                )}
                <td className="px-4 py-2 text-right font-medium text-zinc-900">
                  {naira(Number(e.amount))}
                </td>
                <td className="px-4 py-2 text-zinc-500">{e.app_users?.name ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteExpenseButton expenseId={e.id} />
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                  No expenses recorded for this term yet.
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
