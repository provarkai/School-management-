import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { AttendanceGrid } from "./AttendanceGrid";
import type { AttendanceStatus } from "@/lib/types";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const { profile } = await requireUser();
  const { class: classParam, date: dateParam } = await searchParams;
  const supabase = await createClient();

  const date = dateParam || new Date().toISOString().slice(0, 10);

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher") {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }
  const { data: classes } = await classesQuery;

  const selectedClassId = classParam || classes?.[0]?.id;

  if (!selectedClassId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-zinc-900">Attendance</h1>
        <p className="text-sm text-zinc-500">
          {profile.role === "teacher"
            ? "You have not been assigned a class yet — ask the proprietor to assign you one."
            : "No classes have been created yet."}
        </p>
      </div>
    );
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("class_id", selectedClassId)
    .eq("status", "active")
    .order("full_name");

  const { data: existingRows } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("class_id", selectedClassId)
    .eq("date", date);

  const existing: Record<string, AttendanceStatus> = Object.fromEntries(
    (existingRows ?? []).map((r) => [r.student_id, r.status as AttendanceStatus])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Attendance</h1>
        {profile.role === "proprietor" && (
          <Link
            href="/attendance/history"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            View history
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        {(classes ?? []).length > 1 && (
          <label className="text-sm font-medium text-zinc-700">
            Class
            <select
              name="class"
              defaultValue={selectedClassId}
              className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
            >
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input
            type="date"
            name="date"
            defaultValue={date}
            max={new Date().toISOString().slice(0, 10)}
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Go
        </button>
      </form>

      <AttendanceGrid
        classId={selectedClassId}
        date={date}
        students={students ?? []}
        existing={existing}
      />
    </div>
  );
}
