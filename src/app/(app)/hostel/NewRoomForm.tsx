"use client";

import { useActionState } from "react";
import { createRoom, type RoomFormState } from "./actions";

const initialState: RoomFormState = {};

export function NewRoomForm({ hostelId }: { hostelId: string }) {
  const [state, action, pending] = useActionState(createRoom, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="hostel_id" value={hostelId} />
      {state.error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="text-xs font-medium text-zinc-700">
        Room name
        <input
          name="name"
          required
          placeholder="e.g. Room 12"
          className="mt-1 block rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-xs font-medium text-zinc-700">
        Capacity
        <input
          name="capacity"
          type="number"
          min="1"
          placeholder="Optional"
          className="mt-1 block w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add room"}
      </button>
    </form>
  );
}
