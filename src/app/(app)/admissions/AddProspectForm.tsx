"use client";

import { useActionState } from "react";
import { createProspect, type ProspectFormState } from "./actions";

const initialState: ProspectFormState = {};

export function AddProspectForm({ campuses }: { campuses: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createProspect, initialState);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">Add a prospect</h2>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <form
        action={action}
        className={`grid grid-cols-1 gap-3 sm:items-end ${
          campuses.length > 0 ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <label className="text-sm font-medium text-zinc-700">
          Child&rsquo;s name
          <input
            name="full_name"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Date of birth
          <input
            name="date_of_birth"
            type="date"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Desired class
          <input
            name="desired_class"
            placeholder="e.g. JSS1"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Parent name
          <input
            name="parent_name"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Parent phone
          <input
            name="parent_phone"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Parent email
          <input
            name="parent_email"
            type="email"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        {campuses.length > 0 && (
          <label className="text-sm font-medium text-zinc-700">
            Campus
            <select
              name="campus_id"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">Unspecified</option>
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
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:w-fit"
        >
          {pending ? "Saving…" : "Add prospect"}
        </button>
      </form>
    </section>
  );
}
