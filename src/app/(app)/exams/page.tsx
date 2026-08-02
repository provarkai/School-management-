import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewExamForm } from "./NewExamForm";
import { DeleteExamButton } from "./DeleteExamButton";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  published: "bg-emerald-100 text-emerald-700",
  closed: "bg-red-100 text-red-700",
};

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, isManager, school } = await requireUser();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher" && !isManager) {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }
  const { data: classes } = await classesQuery;

  if (!classes || classes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Exams</h1>
        <p className="text-sm text-zinc-500">
          {profile.role === "teacher" && !isManager
            ? "You have not been assigned a class yet — ask the proprietor to assign you one."
            : "No classes have been created yet."}
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;

  const [{ data: subjectRows }, { data: exams }] = await Promise.all([
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
    supabase
      .from("exams")
      .select("id, subject, title, duration_minutes, status")
      .eq("class_id", selectedClassId)
      .order("created_at", { ascending: false }),
  ]);

  const examIds = (exams ?? []).map((e) => e.id);
  const [{ data: questionCounts }, { data: attemptCounts }] = await Promise.all([
    examIds.length > 0
      ? supabase.from("exam_questions").select("exam_id").in("exam_id", examIds)
      : Promise.resolve({ data: [] }),
    examIds.length > 0
      ? supabase.from("exam_attempts").select("exam_id").in("exam_id", examIds)
      : Promise.resolve({ data: [] }),
  ]);

  const questionCountByExam = new Map<string, number>();
  for (const q of questionCounts ?? []) {
    questionCountByExam.set(q.exam_id, (questionCountByExam.get(q.exam_id) ?? 0) + 1);
  }
  const attemptCountByExam = new Map<string, number>();
  for (const a of attemptCounts ?? []) {
    attemptCountByExam.set(a.exam_id, (attemptCountByExam.get(a.exam_id) ?? 0) + 1);
  }

  const subjects = (subjectRows ?? []).map((s) => s.name);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Exams</h1>
        <p className="text-sm text-zinc-500">
          {school?.current_session} · Term {school?.current_term} — auto-graded multiple-choice
          exams students take through their existing share link.
        </p>
      </div>

      {classes.length > 1 && (
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
      )}

      <NewExamForm classes={classes} subjects={subjects} defaultClassId={selectedClassId} />

      {(exams ?? []).length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No exams for this class yet.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <ul className="divide-y divide-zinc-100">
            {(exams ?? []).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    {e.subject && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {e.subject}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}>
                      {e.status}
                    </span>
                  </div>
                  <Link
                    href={`/exams/${e.id}`}
                    className="mt-1 block text-sm font-medium text-zinc-900 hover:underline"
                  >
                    {e.title}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-400">
                    {e.duration_minutes} min · {questionCountByExam.get(e.id) ?? 0} question
                    {(questionCountByExam.get(e.id) ?? 0) === 1 ? "" : "s"} ·{" "}
                    {attemptCountByExam.get(e.id) ?? 0} attempt
                    {(attemptCountByExam.get(e.id) ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <DeleteExamButton examId={e.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
