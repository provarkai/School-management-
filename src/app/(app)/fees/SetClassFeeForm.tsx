"use client";

import { useActionState } from "react";
import { setClassFeeAmount, type BulkSetClassFeeState } from "./actions";

const initialState: BulkSetClassFeeState = {};

export function SetClassFeeForm({
  classes,
  feeTypes,
}: {
  classes: { id: string; name: string }[];
  feeTypes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(setClassFeeAmount, initialState);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-zinc-900">Set fee for a whole class</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Applies this amount to every active student in the class for the current term. Existing
        amounts for that fee type are overwritten.
      </p>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
        <label className="text-sm font-medium text-zinc-700">
          Class
          <select
            name="class_id"
            required
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="" disabled>
              Choose a class
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Fee type
          <select
            name="fee_type_id"
            required
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="" disabled>
              Choose a fee type
            </option>
            {feeTypes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Amount
          <input
            name="amount_expected"
            type="number"
            min={0}
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Applying…" : "Apply to class"}
        </button>
      </form>
    </section>
  );
}
