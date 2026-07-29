"use client";

import { useActionState } from "react";
import { sendGeneralAnnouncement, type GeneralAnnouncementState } from "./actions";

const initialState: GeneralAnnouncementState = {};

export function GeneralAnnouncementForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(sendGeneralAnnouncement, initialState);

  return (
    <form action={action} className="space-y-3">
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
          placeholder="e.g. School resumes Monday 8am. PTA meeting this Saturday at 10am."
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block max-w-xs text-sm font-medium text-zinc-700">
        Send to
        <select
          name="class_id"
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All parents</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} only
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send announcement"}
      </button>
    </form>
  );
}
