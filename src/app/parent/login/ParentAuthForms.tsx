"use client";

import { useActionState, useState } from "react";
import { parentSignIn, parentSignUp, type AuthActionState } from "./actions";

const initialState: AuthActionState = {};

export function ParentAuthForms() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    parentSignIn,
    initialState
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    parentSignUp,
    initialState
  );

  const state = mode === "signin" ? signInState : signUpState;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex rounded-lg bg-zinc-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "signin" ? "bg-white shadow text-zinc-900" : "text-zinc-500"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "signup" ? "bg-white shadow text-zinc-900" : "text-zinc-500"
          }`}
        >
          Create account
        </button>
      </div>

      {state.error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      {mode === "signin" ? (
        <form action={signInAction} className="space-y-4">
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required />
          <SubmitButton pending={signInPending} label="Sign in" />
        </form>
      ) : (
        <form action={signUpAction} className="space-y-4">
          <Field label="Your full name" name="name" type="text" required />
          <Field label="Email" name="email" type="email" required />
          <Field label="Phone" name="phone" type="tel" />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            hint="At least 8 characters"
          />
          <p className="text-xs text-zinc-400">
            Use the same email the school has on file for you as your child&apos;s parent
            contact — that&apos;s how we link your account to your child.
          </p>
          <SubmitButton pending={signUpPending} label="Create account" />
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type,
  required,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {hint && <span className="mt-1 block text-xs font-normal text-zinc-400">{hint}</span>}
    </label>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}
