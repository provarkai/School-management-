"use client";

import { useActionState } from "react";
import { updateParentEmail, type ParentEmailFormState } from "../actions";

const initialState: ParentEmailFormState = {};

export function ParentEmailForm({
  studentId,
  currentEmail,
}: {
  studentId: string;
  currentEmail: string | null;
}) {
  const action = updateParentEmail.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <label className="block text-sm font-medium text-zinc-700">
        Parent portal email
        <input
          name="parent_email"
          type="email"
          defaultValue={currentEmail ?? ""}
          placeholder="parent@example.com"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-400">
          The parent signs up at /parent/login using this email to see this student&apos;s fees,
          attendance and results.
        </span>
      </label>

      {state.error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
