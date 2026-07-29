"use client";

import { useActionState } from "react";
import {
  changeOwnPassword,
  updateOwnProfile,
  updateSchoolProfile,
  updateAcademicSession,
  type ProfileFormState,
} from "./actions";
import type { Term } from "@/lib/types";

const initialState: ProfileFormState = {};

export function SchoolProfileForm({
  name,
  address,
  phone,
}: {
  name: string;
  address: string | null;
  phone: string | null;
}) {
  const [state, action, pending] = useActionState(updateSchoolProfile, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        School name
        <input
          name="school_name"
          defaultValue={name}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Address
        <input
          name="school_address"
          defaultValue={address ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        School phone
        <input
          name="school_phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder="+234…"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-400">
          Shown to parents on their dashboard as a number to call the school office.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function AcademicSessionForm({ session, term }: { session: string; term: Term }) {
  const [state, action, pending] = useActionState(updateAcademicSession, initialState);

  return (
    <form action={action} className="flex max-w-sm flex-wrap items-end gap-3">
      <div className="w-full">
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
        Session
        <input
          name="current_session"
          defaultValue={session}
          placeholder="2025/2026"
          required
          className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Term
        <select
          name="current_term"
          defaultValue={term}
          className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="1">1st Term</option>
          <option value="2">2nd Term</option>
          <option value="3">3rd Term</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function EditProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, action, pending] = useActionState(updateOwnProfile, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        Full name
        <input
          name="name"
          defaultValue={name}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Phone
        <input
          name="phone"
          defaultValue={phone ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initialState);

  return (
    <form action={action} className="max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        New password
        <input
          name="password"
          type="password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-400">At least 8 characters</span>
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Confirm new password
        <input
          name="confirm_password"
          type="password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
