import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewSubjectForm } from "./NewSubjectForm";
import { DeleteSubjectButton } from "./DeleteSubjectButton";

export default async function SubjectsPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Subjects</h1>
        <p className="text-sm text-zinc-500">
          Subjects on this list appear in the score-entry dropdown on report cards.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <NewSubjectForm />
      </section>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <tbody className="divide-y divide-zinc-100">
            {(subjects ?? []).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{s.name}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteSubjectButton subjectId={s.id} />
                </td>
              </tr>
            ))}
            {(subjects ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-zinc-400">
                  No subjects yet — add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
