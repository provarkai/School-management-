"use client";

import { useActionState, useState } from "react";
import {
  signIn,
  signUp,
  resendConfirmation,
  requestPasswordReset,
  type AuthActionState,
} from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

const initialState: AuthActionState = {};

export function AuthForms() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInEmail, setSignInEmail] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendConfirmation,
    initialState
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
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
        <>
          <form action={signInAction} className="space-y-4">
            <Field
              label="Email"
              name="email"
              type="email"
              required
              value={signInEmail}
              onChange={setSignInEmail}
            />
            <Field label="Password" name="password" type="password" required />
            <SubmitButton pending={signInPending} label="Sign in" />
          </form>

          {!showForgotPassword ? (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="mt-3 w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Forgot password?
            </button>
          ) : (
            <form action={resetAction} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
              <label className="block text-sm font-medium text-zinc-700">
                Email for password reset
                <input
                  name="email"
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </label>
              <button
                type="submit"
                disabled={resetPending || !signInEmail}
                className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
              >
                {resetPending ? "Sending…" : "Send password reset link"}
              </button>
              {resetState.error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {resetState.error}
                </p>
              )}
              {resetState.message && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {resetState.message}
                </p>
              )}
            </form>
          )}
        </>
      ) : (
        <>
          <form action={signUpAction} className="space-y-4">
            <Field label="Full name" name="name" type="text" required />
            <Field
              label="Email"
              name="email"
              type="email"
              required
              value={signUpEmail}
              onChange={setSignUpEmail}
            />
            <Field
              label="Password"
              name="password"
              type="password"
              required
              hint="At least 8 characters"
            />
            <SubmitButton pending={signUpPending} label="Create account" />
          </form>
          <form action={resendAction} className="mt-3">
            <input type="hidden" name="email" value={signUpEmail} />
            <button
              type="submit"
              disabled={resendPending || !signUpEmail}
              className="w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
            >
              {resendPending ? "Resending…" : "Already signed up? Resend confirmation email"}
            </button>
            {resendState.error && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {resendState.error}
              </p>
            )}
            {resendState.message && (
              <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {resendState.message}
              </p>
            )}
          </form>
        </>
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
  value,
  onChange,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const inputClassName =
    "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

  return (
    <label className="block text-sm font-medium text-zinc-700">
      {label}
      {type === "password" ? (
        <PasswordInput name={name} required={required} className={inputClassName} />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={inputClassName}
        />
      )}
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
