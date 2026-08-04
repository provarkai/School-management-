"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

export async function updateOwnParentProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { authId } = await requireParent();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("parents")
    .update({ name, phone: phone || null })
    .eq("id", authId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/parent/profile");
  return { success: "Profile updated." };
}

export async function saveParentProfilePhoto(url: string): Promise<void> {
  const { authId } = await requireParent();

  const supabase = await createClient();
  const { error } = await supabase.from("parents").update({ photo_url: url }).eq("id", authId);
  if (error) throw new Error(error.message);

  revalidatePath("/parent/profile");
}

export async function changeOwnParentPassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  await requireParent();

  // Current password required — Supabase Auth's "Secure password change"
  // setting enforces it, so a borrowed session can't change the password.
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password,
    current_password: currentPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password changed." };
}
