import Link from "next/link";
import { fetchAllRows } from "@/lib/fetchAll";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { CampusFilter } from "../CampusFilter";
import { EnrollmentStats } from "./EnrollmentStats";
import { TableSearch } from "@/components/TableSearch";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; campus?: string }>;
}) {
  const { profile, isManager } = await requireUser();
  const { class: classFilter, campus: campusFilter } = await searchParams;
  const supabase = await createClient();

  // The roster is read in full rather than one request's worth: a school
  // past a few hundred students would otherwise find pupils simply missing
  // from the list, with no error to explain it.
  const [{ data: classes }, { data: campuses }, studentsRaw, enrollmentRows] = await Promise.all([
    supabase.from("classes").select("id, name, campus_id").order("name"),
    supabase
      .from("campuses")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    fetchAllRows<{
      id: string;
      full_name: string;
      class_id: string | null;
      parent_name: string | null;
      parent_phone: string | null;
      status: string;
    }>((from, to) => {
      let query = supabase
        .from("students")
        .select("id, full_name, class_id, parent_name, parent_phone, status")
        .order("full_name")
        .order("id");
      if (classFilter) query = query.eq("class_id", classFilter);
      return query.range(from, to);
    }),
    isManager
      ? fetchAllRows<{ admission_date: string; status: string }>((from, to) =>
          supabase
            .from("students")
            .select("admission_date, status")
            .order("id")
            .range(from, to)
        )
      : Promise.resolve(null),
  ]);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const classesInCampus = campusFilter
    ? new Set((classes ?? []).filter((c) => c.campus_id === campusFilter).map((c) => c.id))
    : null;

  const students = classesInCampus
    ? studentsRaw.filter((s) => s.class_id && classesInCampus.has(s.class_id))
    : studentsRaw;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Students</h1>
        {isManager && (
          <div className="flex gap-2">
            <Link
              href="/students/custom-fields"
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Custom fields
            </Link>
            <Link
              href="/students/import"
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Bulk import CSV
            </Link>
            <Link
              href="/students/new"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Register student
            </Link>
          </div>
        )}
      </div>

      {isManager && enrollmentRows && (
        <EnrollmentStats students={enrollmentRows} />
      )}

      {isManager && (campuses ?? []).length > 0 && (
        <CampusFilter campuses={campuses ?? []} current={campusFilter ?? ""} />
      )}

      {isManager && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/students"
            className={`rounded-full px-3 py-1 ${
              !classFilter ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            All classes
          </Link>
          {(classes ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/students?class=${c.id}`}
              className={`rounded-full px-3 py-1 ${
                classFilter === c.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search students…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Parent</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Parent phone</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {students.map((s) => {
                const className = s.class_id ? classNameById.get(s.class_id) ?? "—" : "—";
                return (
                  <tr
                    key={s.id}
                    data-search-row={[s.full_name, className, s.parent_name, s.parent_phone]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td className="px-4 py-2 font-medium text-zinc-900">
                      <Link href={`/students/${s.id}`} className="hover:underline">
                        {s.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-500">{className}</td>
                    <td className="px-4 py-2 text-zinc-500">{s.parent_name ?? "—"}</td>
                    <td className="px-4 py-2 text-zinc-500">{s.parent_phone ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/students/${s.id}`}
                        className="font-medium text-zinc-600 hover:text-zinc-900"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    No students found.
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
