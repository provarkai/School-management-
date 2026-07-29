"use client";

import { useActionState, useState } from "react";
import { addStaffMember, type AddTeacherState } from "./actions";

const initialState: AddTeacherState = {};

export function AddTeacherForm({
  subjects,
  campuses,
}: {
  subjects: string[];
  campuses: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addStaffMember, initialState);
  const [role, setRole] = useState<"teacher" | "staff">("teacher");

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">Add staff</h2>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.tempPassword && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Staff account created. Temporary password:{" "}
          <span className="font-mono font-semibold">{state.tempPassword}</span> — share
          this with them securely; they can change it after signing in.
        </p>
      )}
      <form
        action={action}
        className={`grid grid-cols-1 gap-3 sm:items-end ${
          campuses.length > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"
        }`}
      >
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
        <label className="text-sm font-medium text-zinc-700">
          Type
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "teacher" | "staff")}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="teacher">Teacher</option>
            <option value="staff">Non-teaching staff</option>
          </select>
        </label>
        {role === "teacher" ? (
          <label className="text-sm font-medium text-zinc-700">
            Subject taught
            <select
              name="subject"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">Unassigned</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-sm font-medium text-zinc-700">
            Job title
            <input
              name="job_title"
              placeholder="e.g. Bursar, Security, Cleaner"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
        )}
        {campuses.length > 0 && (
          <label className="text-sm font-medium text-zinc-700">
            Campus
            <select
              name="campus_id"
              defaultValue=""
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
          className={`rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:w-fit ${
            campuses.length > 0 ? "sm:col-span-5" : "sm:col-span-4"
          }`}
        >
          {pending ? "Adding…" : "Add staff"}
        </button>
      </form>
    </div>
  );
}
