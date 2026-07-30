"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";
import { QUICK_LINK_CATALOG, MAX_QUICK_LINKS } from "@/lib/quickLinks";

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

export async function updateSchoolProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const name = String(formData.get("school_name") ?? "").trim();
  const address = String(formData.get("school_address") ?? "").trim();
  const phone = String(formData.get("school_phone") ?? "").trim();

  if (!name) {
    return { error: "School name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ name, address: address || null, phone: phone || null })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: "School profile updated." };
}

export async function saveSchoolLogo(url: string): Promise<void> {
  const { profile } = await requireProprietor();

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ logo_url: url })
    .eq("id", profile.school_id ?? "");

  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function updateAcademicSession(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const session = String(formData.get("current_session") ?? "").trim();
  const term = String(formData.get("current_term") ?? "") as Term;

  if (!session) {
    return { error: "Enter the current session, e.g. 2025/2026." };
  }
  if (!["1", "2", "3"].includes(term)) {
    return { error: "Choose a term." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ current_session: session, current_term: term })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: "Academic session updated." };
}

export async function updateQuickLinks(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const { profile } = await requireProprietor();

  const validKeys = new Set(QUICK_LINK_CATALOG.map((o) => o.key));
  const selected = formData.getAll("quick_links").map(String).filter((k) => validKeys.has(k));

  if (selected.length === 0) {
    return { error: "Choose at least one quick link." };
  }
  if (selected.length > MAX_QUICK_LINKS) {
    return { error: `Choose at most ${MAX_QUICK_LINKS} quick links.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({ quick_links: selected })
    .eq("id", profile.school_id ?? "");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: "Quick links updated." };
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
