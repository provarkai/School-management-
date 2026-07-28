"use client";

import { useActionState } from "react";
import { addTeacher, type AddTeacherState } from "./actions";

const initialState: AddTeacherState = {};

export function AddTeacherForm() {
  const [state, action, pending] = useActionState(addTeacher, initialState);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">Add a teacher</h2>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.tempPassword && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Teacher account created. Temporary password:{" "}
          <span className="font-mono font-semibold">{state.tempPassword}</span> — share
          this with them securely; they can change it after signing in.
        </p>
      )}
      <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <label className="text-sm font-medium text-zinc-700">
          Full name
          <input
            name="name"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Phone
          <input
            name="phone"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-3 sm:w-fit"
        >
          {pending ? "Adding…" : "Add teacher"}
        </button>
      </form>
    </div>
  );
}
