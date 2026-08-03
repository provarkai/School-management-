"use client";

import { useActionState } from "react";
import { createPinBatch, type BatchFormState } from "./actions";

const initialState: BatchFormState = {};

export function GenerateBatchForm({ suggestedSession }: { suggestedSession: string }) {
  const [state, action, pending] = useActionState(createPinBatch, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <label className="text-sm font-medium text-zinc-700">
          Session
          <input
            name="session"
            defaultValue={suggestedSession}
            placeholder="2025/2026"
            required
            className="mt-1 block w-36 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Term
          <select
            name="term"
            defaultValue="1"
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="1">1st Term</option>
            <option value="2">2nd Term</option>
            <option value="3">3rd Term</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Quantity
          <input
            name="quantity"
            type="number"
            min={1}
            max={1000}
            defaultValue={50}
            required
            className="mt-1 block w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Price per card (optional)
          <input
            name="price"
            type="number"
            min={0}
            step="1"
            placeholder="e.g. 200"
            className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          <span className="mt-1 block text-xs font-normal text-zinc-400">Printed on the card</span>
        </label>
      </div>
      <label className="block text-sm font-medium text-zinc-700">
        Note (for your own records, not printed)
        <input
          name="note"
          placeholder="e.g. Printed by ABC Press, collected 3rd Aug"
          className="mt-1 block w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate batch"}
      </button>
    </form>
  );
}
