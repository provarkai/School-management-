import { fetchAllRows } from "@/lib/fetchAll";
import type { createClient } from "@/lib/supabase/server";
import type { FeeStatus } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const FEES_EXPORT_COLUMNS = [
  { key: "student_name", label: "Student" },
  { key: "class", label: "Class" },
  { key: "parent_name", label: "Parent" },
  { key: "parent_phone", label: "Parent Phone" },
  { key: "amount_expected", label: "Amount Expected" },
  { key: "amount_paid", label: "Amount Paid" },
  { key: "balance", label: "Balance" },
  { key: "status", label: "Status" },
];

export interface FeesExportFilters {
  classFilter?: string | null;
  statusFilter?: string | null;
}

export async function fetchFeesExportRows(
  supabase: SupabaseClient,
  schoolId: string,
  session: string,
  term: string,
  filters: FeesExportFilters
): Promise<Record<string, unknown>[]> {
  const { classFilter, statusFilter } = filters;

  const [{ data: classes }, studentsQuery] = await Promise.all([
    supabase.from("classes").select("id, name"),
    (async () => {
      let query = supabase
        .from("students")
        .select("id, full_name, class_id, parent_name, parent_phone")
        .eq("status", "active")
        .order("full_name");
      if (classFilter) query = query.eq("class_id", classFilter);
      return query;
    })(),
  ]);

  // Read in full: an export that quietly stopped at the first page would
  // hand the school a spreadsheet missing students, with no sign of it.
  const feeSummaries = await fetchAllRows<{
    student_id: string;
    amount_expected: number;
    amount_paid: number;
    balance: number;
    status: string;
  }>((from, to) => {
    return supabase
      .from("fee_summary")
      .select("student_id, amount_expected, amount_paid, balance, status")
      .eq("school_id", schoolId)
      .eq("session", session)
      .eq("term", term)
      .order("fee_record_id")
      .range(from, to);
  });

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
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

  return (studentsQuery.data ?? [])
    .map((s) => {
      const fee = feeByStudent.get(s.id);
      return {
        student_name: s.full_name,
        class: s.class_id ? classNameById.get(s.class_id) ?? "" : "",
        parent_name: s.parent_name ?? "",
        parent_phone: s.parent_phone ?? "",
        amount_expected: fee?.amount_expected ?? "",
        amount_paid: fee?.amount_paid ?? "",
        balance: fee?.balance ?? "",
        status: fee?.status ?? "not set",
      };
    })
    .filter((r) => (statusFilter ? r.status === statusFilter : true));
}
