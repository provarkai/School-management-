"use client";

import { useActionState } from "react";
import { createSubject, type SubjectFormState } from "./actions";

const initialState: SubjectFormState = {};

export function NewSubjectForm() {
  const [state, action, pending] = useActionState(createSubject, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-auto">
        {state.error && (
          <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <label className="block text-sm font-medium text-zinc-700">
          Subject name
          <input
            name="name"
            required
            placeholder="e.g. Mathematics"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:w-64"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add subject"}
      </button>
    </form>
  );
}
