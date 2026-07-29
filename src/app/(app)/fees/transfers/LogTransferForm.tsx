"use client";

import { useActionState } from "react";
import { logTransferAlert, type TransferFormState } from "./actions";

const initialState: TransferFormState = {};

export function LogTransferForm() {
  const [state, action, pending] = useActionState(logTransferAlert, initialState);

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <div className="sm:col-span-4">
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Amount
        <input
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Narration / description (from the bank alert)
        <input
          name="narration"
          required
          placeholder="e.g. TRF FROM MRS OKAFOR CHIDINMA SCH FEES"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Date
        <input
          name="transfer_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-4 sm:w-fit"
      >
        {pending ? "Logging…" : "Log transfer alert"}
      </button>
    </form>
  );
}
