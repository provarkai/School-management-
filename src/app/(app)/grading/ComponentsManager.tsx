"use client";

import { useActionState } from "react";
import { addComponent, deleteComponent, type GradingFormState } from "./actions";

const initialState: GradingFormState = {};

export interface Component {
  id: string;
  name: string;
  kind: string;
  max_score: number;
}

export function ComponentsManager({ components }: { components: Component[] }) {
  const [state, action, pending] = useActionState(addComponent, initialState);

  const caTotal = components
    .filter((c) => c.kind === "ca")
    .reduce((sum, c) => sum + Number(c.max_score), 0);
  const examTotal = components
    .filter((c) => c.kind === "exam")
    .reduce((sum, c) => sum + Number(c.max_score), 0);
  const grandTotal = caTotal + examTotal;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Assessment components</h2>
      <p className="mt-1 text-xs text-zinc-500">
        How each subject&rsquo;s score is broken down on the report card. CA components are
        summed into the CA column, exam components into the Exam column.
      </p>

      {components.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md border border-zinc-100">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Component</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Counts toward</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Max</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {components.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-zinc-900">{c.name}</td>
                  <td className="px-3 py-2 text-zinc-500">{c.kind === "ca" ? "CA" : "Exam"}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{Number(c.max_score)}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteComponent.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50">
              <tr>
                <td className="px-3 py-2 text-xs font-medium text-zinc-500" colSpan={2}>
                  CA {caTotal} + Exam {examTotal}
                </td>
                <td
                  className={`px-3 py-2 text-right text-sm font-bold ${
                    grandTotal === 100 ? "text-zinc-900" : "text-amber-600"
                  }`}
                >
                  {grandTotal}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {grandTotal !== 100 && components.length > 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          These add up to {grandTotal}, not 100. Report card totals and averages are read as
          percentages, so they&rsquo;ll be off unless that&rsquo;s deliberate.
        </p>
      )}

      {state.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Name
          <input
            name="name"
            required
            placeholder="e.g. CA3"
            className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Counts toward
          <select
            name="kind"
            defaultValue="ca"
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="ca">CA</option>
            <option value="exam">Exam</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Max score
          <input
            name="max_score"
            type="number"
            min="1"
            step="0.5"
            defaultValue={10}
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
