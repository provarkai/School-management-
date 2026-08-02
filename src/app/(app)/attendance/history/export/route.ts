import { fetchAllRows } from "@/lib/fetchAll";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { parseExportFormat, exportRows } from "@/lib/export";

export async function GET(request: Request) {
  const { school } = await requireProprietor();
  const supabase = await createClient();
  const schoolInfo = school
    ? { name: school.name, address: school.address, phone: school.phone }
    : undefined;

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("class");
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = searchParams.get("from") || today;
  const toDate = searchParams.get("to") || today;
  const format = parseExportFormat(searchParams);

  if (!classId) {
    return exportRows(format, [], [], "attendance", schoolInfo);
  }

  const [attendance, { data: students }, { data: klass }] = await Promise.all([
    fetchAllRows<{ date: string; status: string; student_id: string }>((from, to) =>
      supabase
        .from("attendance")
        .select("date, status, student_id")
        .eq("class_id", classId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    supabase.from("students").select("id, full_name").eq("class_id", classId),
    supabase.from("classes").select("name").eq("id", classId).single(),
  ]);

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  const rows = attendance.map((r) => ({
    date: r.date,
    student_name: nameById.get(r.student_id) ?? "",
    status: r.status,
  }));

  return exportRows(
    format,
    rows,
    [
      { key: "date", label: "Date" },
      { key: "student_name", label: "Student" },
      { key: "status", label: "Status" },
    ],
    `attendance-${klass?.name ?? "class"}-${fromDate}-to-${toDate}`,
    schoolInfo
  );
}
