"use client";

import { useActionState, useState } from "react";
import { saveSubjectRegistrations, type RegistrationState } from "./actions";

const initialState: RegistrationState = {};

export function RegistrationGrid({
  classId,
  students,
  subjects,
  initial,
}: {
  classId: string;
  students: { id: string; full_name: string }[];
  subjects: { id: string; name: string }[];
  initial: string[];
}) {
  const action = saveSubjectRegistrations.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [checked, setChecked] = useState<Set<string>>(new Set(initial));

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleColumn(subjectId: string) {
    const keys = students.map((s) => `${s.id}:${subjectId}`);
    const allOn = keys.every((k) => checked.has(k));
    setChecked((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-2 text-left font-medium text-zinc-500">
                Student
              </th>
              {subjects.map((s) => (
                <th key={s.id} className="px-2 py-2 text-center font-medium text-zinc-500">
                  <button
                    type="button"
                    onClick={() => toggleColumn(s.id)}
                    className="whitespace-nowrap text-xs hover:text-zinc-900 hover:underline"
                    title="Toggle whole column"
                  >
                    {s.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {students.map((student) => (
              <tr key={student.id}>
                <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium text-zinc-900">
                  {student.full_name}
                </td>
                {subjects.map((s) => {
                  const key = `${student.id}:${s.id}`;
                  return (
                    <td key={s.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        name="reg"
                        value={key}
                        checked={checked.has(key)}
                        onChange={() => toggle(key)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : `Save ${checked.size} registration${checked.size === 1 ? "" : "s"}`}
        </button>
        <p className="text-xs text-zinc-400">Click a subject heading to tick the whole column.</p>
      </div>
    </form>
  );
}
