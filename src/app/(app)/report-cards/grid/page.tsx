import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getSubjectRoster } from "@/lib/subjectRoster";
import { GradeGrid, type GridComponent } from "./GradeGrid";

export default async function GradeGridPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; subject?: string }>;
}) {
  const { profile, isManager, school } = await requireUser();
  const { class: classParam, subject: subjectParam } = await searchParams;
  const supabase = await createClient();

  const schoolId = profile.school_id ?? "";
  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher" && !isManager) {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }

  const [{ data: classes }, { data: subjects }, { data: componentRows }] = await Promise.all([
    classesQuery,
    supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
    supabase
      .from("assessment_components")
      .select("id, name, kind, max_score")
      .eq("school_id", schoolId)
      .order("position"),
  ]);

  const components = (componentRows ?? []) as GridComponent[];

  if (!classes?.length || !subjects?.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Enter scores</h1>
        <p className="text-sm text-zinc-500">
          {!classes?.length
            ? "You have no classes assigned yet."
            : "No subjects set up yet."}
        </p>
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Enter scores</h1>
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
          No assessment components configured yet.{" "}
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
  const selectedSubjectId = subjectParam || subjects[0].id;

  const { students, fromRegistration } = await getSubjectRoster(
    supabase,
    schoolId,
    selectedClassId,
    selectedSubjectId,
    session
  );

  // Existing scores, so reopening the grid shows what's already been marked
  // rather than a blank sheet that would look like nothing was saved.
  const studentIds = students.map((s) => s.id);
  const { data: existingResults } =
    studentIds.length > 0
      ? await supabase
          .from("results")
          .select("id, student_id")
          .eq("school_id", schoolId)
          .eq("subject_id", selectedSubjectId)
          .eq("session", session)
          .eq("term", term)
          .in("student_id", studentIds)
      : { data: [] };

  const resultIds = (existingResults ?? []).map((r) => r.id);
  const { data: existingScores } =
    resultIds.length > 0
      ? await supabase
          .from("result_component_scores")
          .select("result_id, component_id, score")
          .in("result_id", resultIds)
      : { data: [] };

  const studentByResultId = new Map((existingResults ?? []).map((r) => [r.id, r.student_id]));
  const initial: Record<string, number> = {};
  for (const s of existingScores ?? []) {
    const studentId = studentByResultId.get(s.result_id);
    if (studentId) initial[`${studentId}_${s.component_id}`] = Number(s.score);
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/report-cards" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← Report cards
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Enter scores</h1>
        <p className="text-sm text-zinc-500">
          {session} · Term {term} — a whole class and subject in one save.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
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
        <label className="text-sm font-medium text-zinc-700">
          Subject
          <select
            name="subject"
            defaultValue={selectedSubjectId}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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

      {students.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No students take this subject in this class.
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-400">
            {students.length} student{students.length === 1 ? "" : "s"}
            {fromRegistration
              ? ` registered for ${selectedSubject?.name}`
              : " — whole class (no subject registration set for this subject)"}
          </p>
          <GradeGrid
            key={`${selectedClassId}-${selectedSubjectId}`}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            students={students}
            components={components}
            initial={initial}
          />
        </>
      )}
    </div>
  );
}
