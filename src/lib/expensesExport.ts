import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const EXPENSES_EXPORT_COLUMNS = [
  { key: "expense_date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "vendor", label: "Vendor" },
  { key: "description", label: "Note" },
  { key: "campus", label: "Campus" },
  { key: "amount", label: "Amount" },
  { key: "recorded_by", label: "Recorded By" },
];

export interface ExpensesExportFilters {
  categoryFilter?: string | null;
  campusFilter?: string | null;
}

export async function fetchExpensesExportRows(
  supabase: SupabaseClient,
  schoolId: string,
  session: string,
  term: string,
  filters: ExpensesExportFilters
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("expenses")
    .select(
      "amount, expense_date, vendor, description, category_id, campus_id, expense_categories(name), campuses(name), app_users(name)"
    )
    .eq("school_id", schoolId)
    .eq("session", session)
    .eq("term", term)
    .order("expense_date", { ascending: false });
  if (filters.categoryFilter) query = query.eq("category_id", filters.categoryFilter);
  if (filters.campusFilter) query = query.eq("campus_id", filters.campusFilter);

  const { data } = await query;

  return (data ?? []).map((e) => ({
    expense_date: e.expense_date,
    category: (e.expense_categories as unknown as { name: string } | null)?.name ?? "",
    vendor: e.vendor ?? "",
    description: e.description ?? "",
    campus: (e.campuses as unknown as { name: string } | null)?.name ?? "",
    amount: Number(e.amount),
    recorded_by: (e.app_users as unknown as { name: string } | null)?.name ?? "",
  }));
}
