"use client";

import { useActionState } from "react";
import { addGradeBand, deleteGradeBand, type GradingFormState } from "./actions";

const initialState: GradingFormState = {};

export interface GradeBand {
  id: string;
  letter: string;
  min_score: number;
  points: number;
}

export function GradeBandsManager({ bands }: { bands: GradeBand[] }) {
  const [state, action, pending] = useActionState(addGradeBand, initialState);

  // Highest cutoff first — the same order the grading trigger resolves them
  // in, so what's displayed matches what actually gets awarded.
  const sorted = [...bands].sort((a, b) => Number(b.min_score) - Number(a.min_score));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Grade boundaries</h2>
      <p className="mt-1 text-xs text-zinc-500">
        A student&rsquo;s total is matched against the highest boundary it reaches. Points feed
        the GPA shown on report cards.
      </p>

      {sorted.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md border border-zinc-100">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Grade</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Range</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Points</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sorted.map((b, i) => {
                const upper = i === 0 ? 100 : Number(sorted[i - 1].min_score) - 1;
                return (
                  <tr key={b.id}>
                    <td className="px-3 py-2 font-medium text-zinc-900">{b.letter}</td>
                    <td className="px-3 py-2 text-zinc-500">
                      {Number(b.min_score)} – {upper}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-500">{Number(b.points)}</td>
                    <td className="px-3 py-2 text-right">
                      <form action={deleteGradeBand.bind(null, b.id)}>
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > 0 && Number(sorted[sorted.length - 1].min_score) > 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your lowest boundary starts at {Number(sorted[sorted.length - 1].min_score)}. Scores
          below that have no grade — add a band starting at 0 to cover them.
        </p>
      )}

      {state.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Grade
          <input
            name="letter"
            required
            maxLength={3}
            placeholder="A"
            className="mt-1 block w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          From score
          <input
            name="min_score"
            type="number"
            min="0"
            max="100"
            step="1"
            required
            className="mt-1 block w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Points
          <input
            name="points"
            type="number"
            min="0"
            step="0.5"
            defaultValue={0}
            required
            className="mt-1 block w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
    </section>
  );
}
