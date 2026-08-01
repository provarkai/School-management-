"use client";

import { useActionState, useState } from "react";
import { sendBroadcast, type BroadcastState } from "./actions";

const initialState: BroadcastState = {};

export function BroadcastForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(sendBroadcast, initialState);
  const [sendToParents, setSendToParents] = useState(true);

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

      <label className="block text-sm font-medium text-zinc-700">
        Message
        <textarea
          name="message"
          required
          rows={3}
          placeholder="e.g. School is closed today due to flooding. Classes resume tomorrow."
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              name="send_to_parents"
              checked={sendToParents}
              onChange={(e) => setSendToParents(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Send to parents
          </label>
          {sendToParents && (
            <select
              name="class_id"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} only
                </option>
              ))}
            </select>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            name="send_to_staff"
            className="h-4 w-4 rounded border-zinc-300"
          />
          Send to staff (SMS/WhatsApp + posted to Notices)
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send broadcast"}
      </button>
    </form>
  );
}
