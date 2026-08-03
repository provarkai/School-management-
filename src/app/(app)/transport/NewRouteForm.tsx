"use client";

import { useActionState } from "react";
import { createRoute, type RouteFormState } from "./actions";

const initialState: RouteFormState = {};

export function NewRouteForm() {
  const [state, action, pending] = useActionState(createRoute, initialState);

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <div className="sm:col-span-4">
        {state.error && (
          <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Route name
        <input
          name="name"
          required
          placeholder="e.g. Route A — Ikeja"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Driver name
        <input
          name="driver_name"
          placeholder="Optional"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Driver phone
        <input
          name="driver_phone"
          placeholder="Optional"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Vehicle
        <input
          name="vehicle_info"
          placeholder="e.g. Hiace bus, LND-123-AA"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-4 sm:w-fit"
      >
        {pending ? "Adding…" : "Add route"}
      </button>
    </form>
  );
}
