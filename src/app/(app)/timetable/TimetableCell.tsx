"use client";

import { useActionState } from "react";
import { setTimetableEntry, type TimetableCellFormState } from "./actions";

const initialState: TimetableCellFormState = {};

export function TimetableCell({
  classId,
  periodSlotId,
  dayOfWeek,
  subjectId,
  teacherId,
  subjects,
  teachers,
}: {
  classId: string;
  periodSlotId: string;
  dayOfWeek: number;
  subjectId: string | null;
  teacherId: string | null;
  subjects: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
}) {
  const action = setTimetableEntry.bind(null, classId, periodSlotId, dayOfWeek);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
      className="space-y-1"
    >
      <select
        name="subject_id"
        defaultValue={subjectId ?? ""}
        className="block w-full rounded border border-zinc-200 px-1.5 py-1 text-xs"
      >
        <option value="">— Subject —</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        name="teacher_id"
        defaultValue={teacherId ?? ""}
        className="block w-full rounded border border-zinc-200 px-1.5 py-1 text-xs"
      >
        <option value="">— Teacher —</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {state.error && <p className="text-[10px] leading-tight text-red-600">{state.error}</p>}
    </form>
  );
}
