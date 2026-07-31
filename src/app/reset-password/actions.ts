"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
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
