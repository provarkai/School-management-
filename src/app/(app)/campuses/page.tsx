import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewCampusForm } from "./NewCampusForm";
import { CampusRow } from "./CampusRow";

export default async function CampusesPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const [{ data: campuses }, { data: classes }, { data: staff }] = await Promise.all([
    supabase
      .from("campuses")
      .select("id, name, address")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase.from("classes").select("id, campus_id"),
    supabase.from("app_users").select("id, campus_id"),
  ]);

  const classCountByCampus = new Map<string, number>();
  for (const c of classes ?? []) {
    if (!c.campus_id) continue;
    classCountByCampus.set(c.campus_id, (classCountByCampus.get(c.campus_id) ?? 0) + 1);
  }
  const staffCountByCampus = new Map<string, number>();
  for (const s of staff ?? []) {
    if (!s.campus_id) continue;
    staffCountByCampus.set(s.campus_id, (staffCountByCampus.get(s.campus_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Campuses</h1>
        <p className="text-sm text-zinc-500">
          Add a campus for each branch, then assign classes and staff to one in Classes and
          Staff. Leave unassigned if your school is single-campus.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <NewCampusForm />
      </section>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Campus</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Address</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Assigned</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(campuses ?? []).map((campus) => (
              <CampusRow
                key={campus.id}
                campus={campus}
                classCount={classCountByCampus.get(campus.id) ?? 0}
                staffCount={staffCountByCampus.get(campus.id) ?? 0}
              />
            ))}
            {(campuses ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                  No campuses yet — add your first branch above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
