"use client";

import { updateTeacherSubject } from "./actions";

export function TeacherSubjectSelect({
  teacherId,
  subject,
  subjects,
}: {
  teacherId: string;
  subject: string | null;
  subjects: string[];
}) {
  return (
    <form
      action={updateTeacherSubject}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
    >
      <input type="hidden" name="teacher_id" value={teacherId} />
      <select
        name="subject"
        defaultValue={subject ?? ""}
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Unassigned</option>
        {subjects.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}
