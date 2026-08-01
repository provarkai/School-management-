"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";

async function siteOrigin(): Promise<string> {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

// Supabase's auth API sometimes returns an error response with no
// recognizable message field (e.g. when the underlying SMTP send fails
// server-side) — the client library falls back to JSON.stringify-ing the
// raw body, which shows up as a literal "{}" with nothing useful in it.
// Swap that for a message that actually points at the real cause.
function friendlyAuthError(message: string): string {
  if (!message || message.trim().startsWith("{") || message.trim().startsWith("[")) {
    return "Something went wrong sending that email — most likely the mail server rejected it. Check your Supabase SMTP configuration and try again.";
  }
  return message;
}

export interface AuthActionState {
  error?: string;
  message?: string;
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await withAuthTimeout(supabase.auth.signInWithPassword({ email, password }), 15000, {
    user: null,
    session: null,
    weakPassword: null,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  // Same failure mode as the reset-password flow: this RPC runs right
  // between a successful sign-in and the redirect, so if it hangs the
  // browser is left stuck on /login looking signed-in-but-frozen. Default
  // to a non-admin dashboard on timeout — the far more common case.
  const { data: isAdmin } = await withAuthTimeout(supabase.rpc("is_platform_admin"), 8000, null);
  redirect(isAdmin ? "/admin" : "/dashboard");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await withAuthTimeout(
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      },
    }),
    15000,
    { user: null, session: null }
  );

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  // Supabase deliberately doesn't return an error for an email that's
  // already registered (to avoid leaking which emails exist) — instead it
  // returns a user object with an empty identities array and sends no
  // email at all. Without this check the UI would tell them to "check
  // your email" even though nothing was sent.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      error:
        "An account with this email already exists. If you haven't confirmed it yet, use \"Resend confirmation email\" below, or sign in if you already know your password.",
    };
  }

  if (!data.session) {
    return {
      message: "Account created. Check your email to confirm it, then sign in.",
    };
  }

  redirect("/onboarding");
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const { error } = await withAuthTimeout(
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteOrigin()}/auth/recovery`,
    }),
    15000,
    null
  );

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return { message: "Password reset email sent — check your inbox (and spam folder)." };
}

export async function resendConfirmation(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email above first, then resend." };
  }

  const supabase = await createClient();
  const { error } = await withAuthTimeout(
    supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
    }),
    15000,
    { user: null, session: null, messageId: null }
  );

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return { message: "Confirmation email resent — check your inbox (and spam folder)." };
}
