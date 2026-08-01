"use client";

import { useActionState, useState } from "react";
import { promoteSession, type PromotionFormState } from "./actions";

const initialState: PromotionFormState = {};

export interface PromotionClass {
  id: string;
  name: string;
  studentCount: number;
}

export function PromotionForm({
  classes,
  suggestedSession,
}: {
  classes: PromotionClass[];
  suggestedSession: string;
}) {
  const [state, action, pending] = useActionState(promoteSession, initialState);
  const [graduating, setGraduating] = useState<Record<string, boolean>>({});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>
      )}

      <label className="block max-w-xs text-sm font-medium text-zinc-700">
        New session
        <input
          name="new_session"
          required
          defaultValue={suggestedSession}
          placeholder="e.g. 2026/2027"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Current class</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Students</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Promote to (new session, term 1)</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Graduating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {classes.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{c.name}</td>
                <td className="px-4 py-2 text-zinc-500">{c.studentCount}</td>
                <td className="px-4 py-2">
                  <input
                    name={`target_${c.id}`}
                    defaultValue={c.name}
                    disabled={!!graduating[c.id]}
                    className="block w-full max-w-[12rem] rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    name={`graduate_${c.id}`}
                    checked={!!graduating[c.id]}
                    onChange={(e) =>
                      setGraduating((prev) => ({ ...prev, [c.id]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400">
        Leaving &ldquo;Promote to&rdquo; blank skips that class (its students stay where they are).
        Old classes and their attendance/results history are kept, not deleted.
      </p>

      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("This changes the school's active session and moves students into new classes. Continue?")) {
            e.preventDefault();
          }
        }}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Promoting…" : "Promote & start new session"}
      </button>
    </form>
  );
}
