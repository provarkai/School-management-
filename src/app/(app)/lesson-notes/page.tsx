import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { LESSON_NOTE_STATUS_LABELS, type LessonNoteStatus } from "@/lib/types";
import { NewLessonNoteForm } from "./NewLessonNoteForm";
import { LessonNoteActions } from "./LessonNoteActions";

const STATUS_STYLES: Record<LessonNoteStatus, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  needs_revision: "bg-red-100 text-red-700",
};

export default async function LessonNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, isManager } = await requireUser();
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
        <h1 className="text-2xl font-bold text-zinc-900">Lesson Notes</h1>
        <p className="text-sm text-zinc-500">
          {profile.role === "teacher" && !isManager
            ? "You have not been assigned a class yet — ask the proprietor to assign you one."
            : "No classes have been created yet."}
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;

  const [{ data: subjectRows }, { data: noteRows }] = await Promise.all([
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
    supabase
      .from("lesson_notes")
      .select(
        "id, subject, topic, lesson_date, content, file_path, file_name, status, review_note, created_by, created_at"
      )
      .eq("class_id", selectedClassId)
      .order("lesson_date", { ascending: false }),
  ]);

  const subjects = (subjectRows ?? []).map((s) => s.name);

  const authorIds = Array.from(new Set((noteRows ?? []).map((n) => n.created_by).filter((id): id is string => !!id)));
  const { data: authors } =
    authorIds.length > 0
      ? await supabase.from("app_users").select("id, name").in("id", authorIds)
      : { data: [] };
  const authorNameById = new Map((authors ?? []).map((a) => [a.id, a.name]));

  const notes = await Promise.all(
    (noteRows ?? []).map(async (n) => {
      if (!n.file_path) return { ...n, viewUrl: null as string | null };
      const { data: signed } = await supabase.storage
        .from("lesson-notes")
        .createSignedUrl(n.file_path, 3600);
      return { ...n, viewUrl: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Lesson Notes</h1>
          <p className="text-sm text-zinc-500">
            {isManager
              ? "Review notes submitted by teachers before the lesson is delivered."
              : "Write up your lesson plan and submit it for review."}
          </p>
        </div>
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

      <NewLessonNoteForm
        schoolId={profile.school_id ?? ""}
        classes={classes}
        subjects={subjects}
        defaultClassId={selectedClassId}
      />

      {notes.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No lesson notes for this class yet.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const isAuthor = n.created_by === profile.id;
            return (
              <div key={n.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {n.subject}
                      </span>
                      <span className="text-xs text-zinc-400">{n.lesson_date}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{n.topic}</p>
                    <p className="text-xs text-zinc-400">
                      {n.created_by ? authorNameById.get(n.created_by) ?? "Staff" : "Staff"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[n.status as LessonNoteStatus]}`}
                  >
                    {LESSON_NOTE_STATUS_LABELS[n.status as LessonNoteStatus]}
                  </span>
                </div>

                {n.content && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{n.content}</p>}
                {n.viewUrl && (
                  <a
                    href={n.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    {n.file_name ? `Download ${n.file_name}` : "Open file"} →
                  </a>
                )}
                {n.review_note && (
                  <p className="mt-2 text-xs text-zinc-400">Review note: {n.review_note}</p>
                )}

                <LessonNoteActions
                  noteId={n.id}
                  status={n.status as LessonNoteStatus}
                  filePath={n.file_path}
                  isAuthor={isAuthor}
                  isManager={isManager}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
