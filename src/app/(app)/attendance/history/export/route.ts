import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("class");
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = searchParams.get("from") || today;
  const toDate = searchParams.get("to") || today;

  if (!classId) {
    return csvResponse(toCsv([], []), "attendance.csv");
  }

  const [{ data: attendance }, { data: students }, { data: klass }] = await Promise.all([
    supabase
      .from("attendance")
      .select("date, status, student_id")
      .eq("class_id", classId)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: false }),
    supabase.from("students").select("id, full_name").eq("class_id", classId),
    supabase.from("classes").select("name").eq("id", classId).single(),
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  const rows = (attendance ?? []).map((r) => ({
    date: r.date,
    student_name: nameById.get(r.student_id) ?? "",
    status: r.status,
  }));

  const csv = toCsv(rows, [
    { key: "date", label: "Date" },
    { key: "student_name", label: "Student" },
    { key: "status", label: "Status" },
  ]);

  return csvResponse(csv, `attendance-${klass?.name ?? "class"}-${fromDate}-to-${toDate}.csv`);
}
