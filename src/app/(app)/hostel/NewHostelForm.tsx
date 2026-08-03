"use client";

import { useActionState } from "react";
import { createHostel, type HostelFormState } from "./actions";

const initialState: HostelFormState = {};

export function NewHostelForm() {
  const [state, action, pending] = useActionState(createHostel, initialState);

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
      <div className="sm:col-span-3">
        {state.error && (
          <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Hostel name
        <input
          name="name"
          required
          placeholder="e.g. Girls' Hostel A"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Address / location
        <input
          name="address"
          placeholder="Optional"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add hostel"}
      </button>
    </form>
  );
}
