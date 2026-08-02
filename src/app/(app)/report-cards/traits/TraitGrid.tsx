"use client";

import { useActionState, useState } from "react";
import { saveTraitRatings, type TraitSaveState } from "./actions";

const initialState: TraitSaveState = {};

export interface GridTrait {
  id: string;
  name: string;
  domain: string;
}

export function TraitGrid({
  classId,
  students,
  traits,
  initial,
}: {
  classId: string;
  students: { id: string; full_name: string }[];
  traits: GridTrait[];
  /** `${studentId}_${traitId}` -> rating already on file */
  initial: Record<string, number>;
}) {
  const action = saveTraitRatings.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)]))
  );

  function setColumn(traitId: string, rating: string) {
    setValues((prev) => {
      const next = { ...prev };
      for (const s of students) next[`${s.id}_${traitId}`] = rating;
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
              {traits.map((t) => (
                <th key={t.id} className="px-2 py-2 text-center font-medium text-zinc-500">
                  <span className="block whitespace-nowrap text-xs">{t.name}</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      setColumn(t.id, e.target.value);
                      e.currentTarget.value = "";
                    }}
                    className="mt-1 rounded border border-zinc-200 px-1 py-0.5 text-[10px] font-normal text-zinc-500"
                    title="Set this rating for the whole class"
                  >
                    <option value="">all…</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
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
                {traits.map((t) => {
                  const key = `${student.id}_${t.id}`;
                  return (
                    <td key={t.id} className="px-2 py-2 text-center">
                      <select
                        name={`rating_${key}`}
                        value={values[key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save ratings"}
        </button>
        <p className="text-xs text-zinc-400">
          5 is highest. Leave a cell blank to leave it unrated — it prints as a dash rather than
          a made-up score.
        </p>
      </div>
    </form>
  );
}
