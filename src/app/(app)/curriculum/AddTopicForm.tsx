"use client";

import { useActionState } from "react";
import { addTopic, type TopicFormState } from "./actions";

const initialState: TopicFormState = {};

export function AddTopicForm({ subjects, defaultSubject }: { subjects: string[]; defaultSubject: string }) {
  const [state, action, pending] = useActionState(addTopic, initialState);

  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <h2 className="text-sm font-semibold text-zinc-900">Add a syllabus topic</h2>
        {state.error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
      </div>

      <label className="text-sm font-medium text-zinc-700">
        Subject
        <select
          name="subject"
          defaultValue={defaultSubject}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Topic title
        <input
          name="title"
          required
          placeholder="e.g. Quadratic equations"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Description (optional)
        <input
          name="description"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Adding…" : "Add topic"}
      </button>
    </form>
  );
}
