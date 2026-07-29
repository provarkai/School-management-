import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { parseExportFormat, exportRows } from "@/lib/export";

export async function GET(request: Request) {
  await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const classFilter = searchParams.get("class");

  const [{ data: classes }, studentsQuery] = await Promise.all([
    supabase.from("classes").select("id, name"),
    (async () => {
      let query = supabase
        .from("students")
        .select(
          "full_name, class_id, date_of_birth, parent_name, parent_phone, parent_email, admission_date, status"
        )
        .order("full_name");
      if (classFilter) query = query.eq("class_id", classFilter);
      return query;
    })(),
  ]);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const rows = (studentsQuery.data ?? []).map((s) => ({
    full_name: s.full_name,
    class: s.class_id ? classNameById.get(s.class_id) ?? "" : "",
    date_of_birth: s.date_of_birth ?? "",
    parent_name: s.parent_name ?? "",
    parent_phone: s.parent_phone ?? "",
    parent_email: s.parent_email ?? "",
    admission_date: s.admission_date,
    status: s.status,
  }));

  const format = parseExportFormat(searchParams);
  return exportRows(
    format,
    rows,
    [
      { key: "full_name", label: "Full Name" },
      { key: "class", label: "Class" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "parent_name", label: "Parent Name" },
      { key: "parent_phone", label: "Parent Phone" },
      { key: "parent_email", label: "Parent Email" },
      { key: "admission_date", label: "Admission Date" },
      { key: "status", label: "Status" },
    ],
    "students"
  );
}
