import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewAssignmentForm } from "./NewAssignmentForm";
import { DeleteAssignmentButton } from "./DeleteAssignmentButton";

export default async function AssignmentsPage({
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
        <h1 className="text-2xl font-bold text-zinc-900">Assignments</h1>
        <p className="text-sm text-zinc-500">
          {profile.role === "teacher" && !isManager
            ? "You have not been assigned a class yet — ask the proprietor to assign you one."
            : "No classes have been created yet."}
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;

  const [{ data: subjectRows }, { data: assignments }] = await Promise.all([
    supabase.from("subjects").select("name").eq("school_id", profile.school_id ?? "").order("name"),
    supabase
      .from("assignments")
      .select("id, subject, title, description, due_date")
      .eq("class_id", selectedClassId)
      .order("due_date", { ascending: false }),
  ]);

  const subjects = (subjectRows ?? []).map((s) => s.name);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (assignments ?? []).filter((a) => a.due_date >= today).reverse();
  const past = (assignments ?? []).filter((a) => a.due_date < today);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Assignments</h1>
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

      <NewAssignmentForm classes={classes} subjects={subjects} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming</h2>
        <AssignmentList assignments={upcoming} emptyMessage="No upcoming assignments." />
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Past</h2>
          <AssignmentList assignments={past} emptyMessage="" />
        </section>
      )}
    </div>
  );
}

function AssignmentList({
  assignments,
  emptyMessage,
}: {
  assignments: { id: string; subject: string | null; title: string; description: string | null; due_date: string }[];
  emptyMessage: string;
}) {
  if (assignments.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <ul className="divide-y divide-zinc-100">
        {assignments.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2">
                {a.subject && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {a.subject}
                  </span>
                )}
                <span className="text-xs text-zinc-400">Due {a.due_date}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-zinc-900">{a.title}</p>
              {a.description && <p className="mt-1 text-xs text-zinc-500">{a.description}</p>}
            </div>
            <DeleteAssignmentButton assignmentId={a.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
