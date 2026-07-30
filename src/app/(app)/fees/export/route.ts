import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { parseExportFormat, exportRows } from "@/lib/export";
import type { FeeStatus } from "@/lib/types";

export async function GET(request: Request) {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const classFilter = searchParams.get("class");
  const statusFilter = searchParams.get("status");
  const typeParam = searchParams.get("type");

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: classes }, { data: feeTypes }, studentsQuery] = await Promise.all([
    supabase.from("classes").select("id, name"),
    supabase.from("fee_types").select("id, name").eq("school_id", profile.school_id ?? ""),
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

  const typeFilter = typeParam === "all" ? null : typeParam || feeTypes?.[0]?.id || null;

  let feeSummaryQuery = supabase
    .from("fee_summary")
    .select("student_id, amount_expected, amount_paid, balance, status")
    .eq("school_id", profile.school_id ?? "")
    .eq("session", session)
    .eq("term", term);
  if (typeFilter) feeSummaryQuery = feeSummaryQuery.eq("fee_type_id", typeFilter);

  const { data: feeSummaries } = await feeSummaryQuery;

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const feeByStudent = new Map<
    string,
    { amount_expected: number; amount_paid: number; balance: number; status: FeeStatus }
  >();
  for (const f of feeSummaries ?? []) {
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

  const rows = (studentsQuery.data ?? [])
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

  const format = parseExportFormat(searchParams);
  return exportRows(
    format,
    rows,
    [
      { key: "student_name", label: "Student" },
      { key: "class", label: "Class" },
      { key: "parent_name", label: "Parent" },
      { key: "parent_phone", label: "Parent Phone" },
      { key: "amount_expected", label: "Amount Expected" },
      { key: "amount_paid", label: "Amount Paid" },
      { key: "balance", label: "Balance" },
      { key: "status", label: "Status" },
    ],
    `fees-${session.replace("/", "-")}-term${term}`,
    school
      ? { name: school.name, address: school.address, phone: school.phone }
      : undefined
  );
}
