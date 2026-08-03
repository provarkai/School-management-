"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";
import { siteOrigin } from "@/lib/siteUrl";

export interface AuthActionState {
  error?: string;
  message?: string;
}

// `next` arrives as a plain hidden form field from a query string a visitor
// controls (?next=...) — only ever follow it if it's a same-app relative
// path, never an absolute URL, so this can't be turned into an open
// redirect off a link the school never actually sent.
function safeNextPath(next: FormDataEntryValue | null): string {
  const value = String(next ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : "/parent";
}

export async function parentSignIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const supabase = await createClient();
  const { data: signInData, error } = await withAuthTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15000,
    { user: null, session: null, weakPassword: null }
  );

  if (error) {
    return { error: error.message };
  }

  // Mirror of the staff sign-in's check: a school staff member who mistakes
  // this for the school manager login will have valid credentials but no
  // parent row — send them to their actual dashboard instead of leaving
  // them stuck on a parent portal with no children linked.
  const { data: parentProfile } = await withAuthTimeout(
    supabase.from("parents").select("id").eq("id", signInData.user!.id).maybeSingle(),
    8000,
    null
  );

  if (!parentProfile) {
    redirect("/dashboard");
  }

  redirect(next);
}

export async function parentSignUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, account_type: "parent" },
      // Without this the confirmation link falls back to the Supabase
      // project's Site URL, which points at the staff app — a parent
      // confirming their email landed on the staff login.
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return {
      message: "Account created. Check your email to confirm it, then sign in.",
    };
  }

  redirect(next);
}
