"use client";

import { updateClassTeacher } from "./actions";

export function ClassTeacherSelect({
  classId,
  teacherId,
  teachers,
}: {
  classId: string;
  teacherId: string | null;
  teachers: { id: string; name: string }[];
}) {
  return (
    <form
      action={updateClassTeacher}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="class_id" value={classId} />
      <select
        name="teacher_id"
        defaultValue={teacherId ?? ""}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Unassigned</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </form>
  );
}
