"use client";

import { updateTeacherCampus } from "./actions";

export function TeacherCampusSelect({
  teacherId,
  campusId,
  campuses,
}: {
  teacherId: string;
  campusId: string | null;
  campuses: { id: string; name: string }[];
}) {
  return (
    <form
      action={updateTeacherCampus}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="teacher_id" value={teacherId} />
      <select
        name="campus_id"
        defaultValue={campusId ?? ""}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Unassigned</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
