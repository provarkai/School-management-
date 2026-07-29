"use client";

import { useActionState } from "react";
import { createAssignment, type AssignmentFormState } from "./actions";

const initialState: AssignmentFormState = {};

export function NewAssignmentForm({
  classes,
  subjects,
}: {
  classes: { id: string; name: string }[];
  subjects: string[];
}) {
  const [state, formAction, pending] = useActionState(createAssignment, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        {state.error && (
          <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Class
        <select
          name="class_id"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Subject (optional)
        <input
          name="subject"
          list="assignment-subjects"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id="assignment-subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Title
        <input
          name="title"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Description (optional)
        <textarea
          name="description"
          rows={2}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Due date
        <input
          name="due_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit sm:self-end"
      >
        {pending ? "Posting…" : "Post assignment"}
      </button>
    </form>
  );
}
