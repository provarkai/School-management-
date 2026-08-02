import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { AddTopicForm } from "./AddTopicForm";
import { DeleteTopicButton } from "./DeleteTopicButton";
import { TopicProgressSelect } from "./TopicProgressSelect";

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; subject?: string }>;
}) {
  const { profile, isManager, school } = await requireUser();
  const { class: classParam, subject: subjectParam } = await searchParams;
  const supabase = await createClient();

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher" && !isManager) {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }

  const [{ data: classes }, { data: subjectRows }] = await Promise.all([
    classesQuery,
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
  ]);

  const subjects = (subjectRows ?? []).map((s) => s.name);

  if (!classes || classes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Curriculum</h1>
        <p className="text-sm text-zinc-500">
          {profile.role === "teacher" && !isManager
            ? "You have not been assigned a class yet — ask the proprietor to assign you one."
            : "No classes have been created yet."}
        </p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Curriculum</h1>
        <p className="text-sm text-zinc-500">
          No subjects set up yet.{" "}
          {isManager && (
            <Link href="/subjects" className="font-medium underline">
              Add some in Subjects
            </Link>
          )}
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;
  const selectedSubject = subjectParam || subjects[0];

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: topics } = await supabase
    .from("syllabus_topics")
    .select("id, position, title, description")
    .eq("school_id", profile.school_id ?? "")
    .eq("subject", selectedSubject)
    .eq("session", session)
    .eq("term", term)
    .order("position");

  const topicIds = (topics ?? []).map((t) => t.id);
  const { data: progressRows } =
    topicIds.length > 0
      ? await supabase
          .from("class_topic_progress")
          .select("topic_id, status")
          .eq("class_id", selectedClassId)
          .in("topic_id", topicIds)
      : { data: [] };

  const progressByTopic = new Map((progressRows ?? []).map((p) => [p.topic_id, p.status]));

  const totalCount = (topics ?? []).length;
  const completedCount = (topics ?? []).filter((t) => progressByTopic.get(t.id) === "completed").length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Curriculum</h1>
        <p className="text-sm text-zinc-500">
          {session} · Term {term} — the syllabus plan per subject, and how far each class has
          gotten through it.
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
            defaultValue={selectedSubject}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
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

      {totalCount > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-900">
              {completedCount}/{totalCount} topics completed
            </span>
            <span className="text-zinc-500">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {isManager && <AddTopicForm subjects={subjects} defaultSubject={selectedSubject} />}

      {totalCount === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No topics planned for {selectedSubject} this term yet.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <ul className="divide-y divide-zinc-100">
            {(topics ?? []).map((t, i) => (
              <li key={t.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {i + 1}. {t.title}
                  </p>
                  {t.description && <p className="mt-1 text-xs text-zinc-500">{t.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <TopicProgressSelect
                    classId={selectedClassId}
                    topicId={t.id}
                    status={progressByTopic.get(t.id) ?? "not_started"}
                  />
                  {isManager && <DeleteTopicButton topicId={t.id} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
