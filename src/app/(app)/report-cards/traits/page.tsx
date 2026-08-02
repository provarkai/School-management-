import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { TraitGrid, type GridTrait } from "./TraitGrid";

export default async function TraitRatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, isManager, school } = await requireUser();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const schoolId = profile.school_id ?? "";
  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher" && !isManager) {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }

  const [{ data: classes }, { data: traitRows }] = await Promise.all([
    classesQuery,
    supabase
      .from("report_card_traits")
      .select("id, name, domain")
      .eq("school_id", schoolId)
      .order("position"),
  ]);

  const traits = (traitRows ?? []) as GridTrait[];

  if (!classes?.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Behaviour &amp; skills</h1>
        <p className="text-sm text-zinc-500">You have no classes assigned yet.</p>
      </div>
    );
  }

  if (traits.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Behaviour &amp; skills</h1>
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
          No traits configured yet.{" "}
          {isManager ? (
            <Link href="/grading" className="font-medium underline">
              Set them up under Grading
            </Link>
          ) : (
            "Ask the proprietor to set them up under Grading."
          )}
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("class_id", selectedClassId)
    .eq("status", "active")
    .order("full_name");

  const studentIds = (students ?? []).map((s) => s.id);
  const { data: ratings } =
    studentIds.length > 0
      ? await supabase
          .from("student_trait_ratings")
          .select("student_id, trait_id, rating")
          .eq("session", session)
          .eq("term", term)
          .in("student_id", studentIds)
      : { data: [] };

  const initial: Record<string, number> = {};
  for (const r of ratings ?? []) {
    initial[`${r.student_id}_${r.trait_id}`] = r.rating;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/report-cards" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← Report cards
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Behaviour &amp; skills</h1>
        <p className="text-sm text-zinc-500">
          {session} · Term {term} — the affective and psychomotor ratings printed on the report
          card.
        </p>
      </div>

      <form method="get" className="flex items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Class
          <select
            name="class"
            defaultValue={selectedClassId}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Go
        </button>
      </form>

      {(students ?? []).length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No active students in this class.
        </p>
      ) : (
        <TraitGrid
          key={selectedClassId}
          classId={selectedClassId}
          students={students ?? []}
          traits={traits}
          initial={initial}
        />
      )}
    </div>
  );
}
