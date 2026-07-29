import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const classFilter = searchParams.get("class");
  const statusFilter = searchParams.get("status");

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: classes }, studentsQuery, { data: feeSummaries }] = await Promise.all([
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
    supabase
      .from("fee_summary")
      .select("student_id, amount_expected, amount_paid, balance, status")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", term),
  ]);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const feeByStudent = new Map((feeSummaries ?? []).map((f) => [f.student_id, f]));

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

  const csv = toCsv(rows, [
    { key: "student_name", label: "Student" },
    { key: "class", label: "Class" },
    { key: "parent_name", label: "Parent" },
    { key: "parent_phone", label: "Parent Phone" },
    { key: "amount_expected", label: "Amount Expected" },
    { key: "amount_paid", label: "Amount Paid" },
    { key: "balance", label: "Balance" },
    { key: "status", label: "Status" },
  ]);

  return csvResponse(csv, `fees-${session.replace("/", "-")}-term${term}.csv`);
}
