import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewClassForm } from "./NewClassForm";
import { ClassTeacherSelect } from "./ClassTeacherSelect";

export default async function ClassesPage() {
  const { school } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: classes }, { data: teachers }, { data: students }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, teacher_id")
      .eq("session", school?.current_session ?? "")
      .eq("term", school?.current_term ?? "1")
      .order("name"),
    supabase.from("app_users").select("id, name").eq("role", "teacher").order("name"),
    supabase.from("students").select("id, class_id").eq("status", "active"),
  ]);

  const studentCountByClass = new Map<string, number>();
  for (const s of students ?? []) {
    if (!s.class_id) continue;
    studentCountByClass.set(s.class_id, (studentCountByClass.get(s.class_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Classes</h1>

      <NewClassForm teachers={teachers ?? []} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Students</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Teacher</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(classes ?? []).map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{c.name}</td>
                <td className="px-4 py-2 text-zinc-500">
                  {studentCountByClass.get(c.id) ?? 0}
                </td>
                <td className="px-4 py-2">
                  <ClassTeacherSelect
                    classId={c.id}
                    teacherId={c.teacher_id}
                    teachers={teachers ?? []}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/students?class=${c.id}`}
                    className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    View students →
                  </Link>
                </td>
              </tr>
            ))}
            {(classes ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                  No classes yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
