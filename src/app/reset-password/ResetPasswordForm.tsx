"use client";

import { useActionState } from "react";
import { setNewPassword, type ResetPasswordState } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(setNewPassword, initialState);

  return (
    <form action={action} className="w-full max-w-sm space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        New password
        <PasswordInput
          name="password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-400">At least 8 characters</span>
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Confirm new password
        <PasswordInput
          name="confirm_password"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
