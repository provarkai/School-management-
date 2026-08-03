"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";

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

  const { data: userData } = await withAuthTimeout(supabase.auth.getUser(), 8000, { user: null });
  const user = userData.user;
  if (!user) {
    return { error: "Your session expired before this could be saved — request a new reset link." };
  }

  const { error } = await withAuthTimeout(supabase.auth.updateUser({ password }), 15000, { user: null });
  if (error) {
    return { error: error.message };
  }

  // Same account can only be staff OR a parent — figure out which so the
  // reset doesn't strand a parent trying to reach a staff-only route. Both
  // of these are plain network calls too (not auth calls, but still able to
  // hang the same way) — bounded so a slow Supabase moment here can't leave
  // the password successfully changed but the page stuck forever.
  const { data: staffProfile } = await withAuthTimeout(
    supabase.from("app_users").select("id").eq("id", user.id).maybeSingle(),
    8000,
    null
  );

  if (!staffProfile) {
    redirect("/parent");
  }

  // Clears the forced-reset flag from addStaffMember/bulkImportStaff now
  // that a real password has been set — best-effort, a failure here
  // shouldn't strand someone who just successfully changed their password.
  await supabase.from("app_users").update({ must_change_password: false }).eq("id", user.id);

  const { data: isAdmin } = await withAuthTimeout(supabase.rpc("is_platform_admin"), 8000, null);
  redirect(isAdmin ? "/admin" : "/dashboard");
}
