"use client";

import { useActionState, useState, useTransition } from "react";
import { createNotice, draftNoticeBody, type NoticeFormState } from "./actions";

const initialState: NoticeFormState = {};

export function NewNoticeForm() {
  const [state, action, pending] = useActionState(createNotice, initialState);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [drafting, startDrafting] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);

  function draft() {
    setDraftError(null);
    startDrafting(async () => {
      const result = await draftNoticeBody(title);
      if (result.error) {
        setDraftError(result.error);
        return;
      }
      if (result.text) setBody(result.text);
    });
  }

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
      {draftError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{draftError}</p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        Title
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. No school tomorrow"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="notice-body" className="block text-sm font-medium text-zinc-700">
            Message
          </label>
          <button
            type="button"
            onClick={draft}
            disabled={drafting}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {drafting ? "Drafting…" : "✨ Draft with AI"}
          </button>
        </div>
        <textarea
          id="notice-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={3}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      <label className="block text-sm font-medium text-zinc-700">
        Audience
        <select
          name="audience"
          defaultValue="all"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="all">All staff</option>
          <option value="teachers">Teachers only</option>
          <option value="staff">Non-teaching staff only</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input name="also_sms" type="checkbox" className="h-4 w-4 rounded border-zinc-300" />
        Also send as SMS to staff phones
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post notice"}
      </button>
    </form>
  );
}
