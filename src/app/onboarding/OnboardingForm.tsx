"use client";

import { useActionState } from "react";
import { createSchool, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createSchool, initialState);

  return (
    <form action={action} className="w-full max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        School name
        <input
          name="name"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Address (optional)
        <input
          name="address"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <fieldset>
        <legend className="block text-sm font-medium text-zinc-700">
          Are you the Proprietor or Proprietress?
        </legend>
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="gender" value="male" defaultChecked />
            Proprietor
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="gender" value="female" />
            Proprietress
          </label>
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create school"}
      </button>
    </form>
  );
}
