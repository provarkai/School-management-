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
