import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { AddTeacherForm } from "./AddTeacherForm";
import { TeacherSubjectSelect } from "./TeacherSubjectSelect";
import { TeacherCampusSelect } from "./TeacherCampusSelect";
import { StaffJobTitleInput } from "./StaffJobTitleInput";

const ROLE_LABELS: Record<string, string> = {
  proprietor: "Proprietor",
  teacher: "Teacher",
  staff: "Non-teaching staff",
};

export default async function StaffPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: staff }, { data: subjectRows }, { data: campuses }] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, name, email, phone, role, subject, job_title, campus_id, photo_url")
      .order("name"),
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
    supabase
      .from("campuses")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
  ]);
  const subjects = (subjectRows ?? []).map((s) => s.name);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Staff</h1>

      <AddTeacherForm subjects={subjects} campuses={campuses ?? []} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2" />
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Email</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Phone</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Type</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Subject / Job title</th>
              {(campuses ?? []).length > 0 && (
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Campus</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(staff ?? []).map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-2">
                  <Avatar
                    url={person.role === "proprietor" ? null : person.photo_url}
                    name={person.name}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-2 text-zinc-900">{person.name}</td>
                <td className="px-4 py-2 text-zinc-500">{person.email}</td>
                <td className="px-4 py-2 text-zinc-500">{person.phone ?? "—"}</td>
                <td className="px-4 py-2 text-zinc-500">
                  {ROLE_LABELS[person.role] ?? person.role}
                </td>
                <td className="px-4 py-2">
                  {person.role === "teacher" ? (
                    <TeacherSubjectSelect
                      teacherId={person.id}
                      subject={person.subject}
                      subjects={subjects}
                    />
                  ) : person.role === "staff" ? (
                    <StaffJobTitleInput staffId={person.id} jobTitle={person.job_title} />
                  ) : (
                    "—"
                  )}
                </td>
                {(campuses ?? []).length > 0 && (
                  <td className="px-4 py-2">
                    {person.role === "teacher" || person.role === "staff" ? (
                      <TeacherCampusSelect
                        teacherId={person.id}
                        campusId={person.campus_id}
                        campuses={campuses ?? []}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
