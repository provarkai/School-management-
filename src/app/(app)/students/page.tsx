import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile } = await requireUser();
  const { class: classFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: classes }, studentsQuery] = await Promise.all([
    supabase.from("classes").select("id, name").order("name"),
    (async () => {
      let query = supabase
        .from("students")
        .select("id, full_name, class_id, parent_name, parent_phone, status")
        .order("full_name");
      if (classFilter) query = query.eq("class_id", classFilter);
      return query;
    })(),
  ]);

  const { data: students } = studentsQuery;
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Students</h1>
        {profile.role === "proprietor" && (
          <div className="flex gap-2">
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

      {profile.role === "proprietor" && (
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

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
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
            {(students ?? []).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{s.full_name}</td>
                <td className="px-4 py-2 text-zinc-500">
                  {s.class_id ? classNameById.get(s.class_id) ?? "—" : "—"}
                </td>
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
            ))}
            {(students ?? []).length === 0 && (
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
  );
}
