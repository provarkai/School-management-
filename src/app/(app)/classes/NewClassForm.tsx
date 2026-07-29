"use client";

import { useActionState } from "react";
import { createClass, type ClassFormState } from "./actions";

const initialState: ClassFormState = {};

export function NewClassForm({
  teachers,
  campuses,
}: {
  teachers: { id: string; name: string }[];
  campuses: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createClass, initialState);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">Add a class</h2>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <form
        action={action}
        className={`grid grid-cols-1 gap-3 sm:items-end ${
          campuses.length > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <label className="text-sm font-medium text-zinc-700">
          Class name
          <input
            name="name"
            required
            placeholder="e.g. JSS1A"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Class teacher
          <select
            name="teacher_id"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">Unassigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {campuses.length > 0 && (
          <label className="text-sm font-medium text-zinc-700">
            Campus
            <select
              name="campus_id"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">Unassigned</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add class"}
        </button>
      </form>
    </div>
  );
}
