import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { RegistrationGrid } from "./RegistrationGrid";

export default async function SubjectRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, school } = await requireProprietor();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const session = school?.current_session ?? "";

  const [{ data: classes }, { data: subjects }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("subjects")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
  ]);

  if (!classes || classes.length === 0 || !subjects || subjects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Subject registration</h1>
        <p className="text-sm text-zinc-500">
          You need at least one class and one subject first.{" "}
          <Link href="/subjects" className="font-medium underline">
            Add subjects
          </Link>
        </p>
      </div>
    );
  }

  const selectedClassId = classParam || classes[0].id;

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("school_id", profile.school_id ?? "")
    .eq("class_id", selectedClassId)
    .eq("status", "active")
    .order("full_name");

  const studentIds = (students ?? []).map((s) => s.id);
  const { data: existing } =
    studentIds.length > 0
      ? await supabase
          .from("student_subjects")
          .select("student_id, subject_id")
          .eq("session", session)
          .in("student_id", studentIds)
      : { data: [] };

  const initial = (existing ?? []).map((r) => `${r.student_id}:${r.subject_id}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Subject registration</h1>
        <p className="text-sm text-zinc-500">
          Which subjects each student offers in {session || "the current session"}. Senior
          classes split into science, arts and commercial combinations; junior classes usually
          take everything.
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
        <RegistrationGrid
          classId={selectedClassId}
          students={students ?? []}
          subjects={subjects}
          initial={initial}
        />
      )}
    </div>
  );
}
