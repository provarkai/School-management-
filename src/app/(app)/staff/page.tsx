import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { AddTeacherForm } from "./AddTeacherForm";
import { TeacherSubjectSelect } from "./TeacherSubjectSelect";

export default async function StaffPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: staff }, { data: subjectRows }] = await Promise.all([
    supabase.from("app_users").select("id, name, email, phone, role, subject").order("name"),
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
  ]);
  const subjects = (subjectRows ?? []).map((s) => s.name);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Staff</h1>

      <AddTeacherForm subjects={subjects} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Email</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Phone</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Role</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Subject</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(staff ?? []).map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-2 text-zinc-900">{person.name}</td>
                <td className="px-4 py-2 text-zinc-500">{person.email}</td>
                <td className="px-4 py-2 text-zinc-500">{person.phone ?? "—"}</td>
                <td className="px-4 py-2 capitalize text-zinc-500">{person.role}</td>
                <td className="px-4 py-2">
                  {person.role === "teacher" ? (
                    <TeacherSubjectSelect
                      teacherId={person.id}
                      subject={person.subject}
                      subjects={subjects}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
