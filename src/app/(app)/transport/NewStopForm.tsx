"use client";

import { useActionState } from "react";
import { createStop, type StopFormState } from "./actions";

const initialState: StopFormState = {};

export function NewStopForm({ routeId }: { routeId: string }) {
  const [state, action, pending] = useActionState(createStop, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="route_id" value={routeId} />
      {state.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="text-xs font-medium text-zinc-700">
        Stop name
        <input
          name="name"
          required
          placeholder="e.g. Allen Avenue"
          className="mt-1 block rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-xs font-medium text-zinc-700">
        Pickup time
        <input
          name="pickup_time"
          placeholder="e.g. 6:30am"
          className="mt-1 block w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-xs font-medium text-zinc-700">
        Drop time
        <input
          name="drop_time"
          placeholder="e.g. 3:30pm"
          className="mt-1 block w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add stop"}
      </button>
    </form>
  );
}
