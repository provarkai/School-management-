"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/authOtp";

export interface ResetPasswordState {
  error?: string;
}

export async function setNewPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();

  const userResult = await withAuthTimeout(supabase.auth.getUser(), 8000);
  const user = "data" in userResult ? userResult.data.user : null;
  if (!user) {
    return { error: "Your session expired before this could be saved — request a new reset link." };
  }

  const { error } = await withAuthTimeout(supabase.auth.updateUser({ password }), 15000);
  if (error) {
    return { error: error.message };
  }

  // Same account can only be staff OR a parent — figure out which so the
  // reset doesn't strand a parent trying to reach a staff-only route.
  const { data: staffProfile } = await supabase
    .from("app_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!staffProfile) {
    redirect("/parent");
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  redirect(isAdmin ? "/admin" : "/dashboard");
}
