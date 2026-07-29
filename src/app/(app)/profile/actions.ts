"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error?: string;
  success?: string;
}

export async function updateOwnProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { authId } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ name, phone: phone || null })
    .eq("id", authId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: "Profile updated." };
}

export async function saveProfilePhoto(url: string): Promise<void> {
  const { authId, profile } = await requireUser();

  if (profile.role === "proprietor") {
    throw new Error("Profile photos aren't available for the proprietor account.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update({ photo_url: url }).eq("id", authId);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
}

export async function changeOwnPassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  await requireUser();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: "Password changed." };
}
