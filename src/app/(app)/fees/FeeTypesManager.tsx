"use client";

import { useActionState, useState } from "react";
import { createFeeType, deleteFeeType, type FeeTypeFormState } from "./actions";

const initialState: FeeTypeFormState = {};

export function FeeTypesManager({ feeTypes }: { feeTypes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createFeeType, initialState);
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Fee types</h2>
          <p className="text-xs text-zinc-400">
            {feeTypes.map((f) => f.name).join(", ") || "None yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          {expanded ? "Hide" : "Manage"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          {feeTypes.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100">
              {feeTypes.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="text-zinc-900">{f.name}</span>
                  <form action={deleteFeeType.bind(null, f.id)}>
                    <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          <form action={action} className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-zinc-700">
              Add a fee type
              <input
                name="name"
                required
                placeholder="e.g. PTA Levy, Exam Fee, Feeding"
                className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:w-64"
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
        </div>
      )}
    </section>
  );
}
