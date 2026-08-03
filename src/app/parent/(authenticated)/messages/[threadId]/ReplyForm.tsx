"use client";

import { useActionState } from "react";
import { replyToThread, type MessageFormState } from "../actions";

const initialState: MessageFormState = {};

export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState(replyToThread.bind(null, threadId), initialState);

  return (
    <form action={action} className="space-y-2">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <textarea
        name="body"
        rows={2}
        required
        placeholder="Write a reply…"
        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Reply"}
      </button>
    </form>
  );
}
