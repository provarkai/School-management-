"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface CampusFormState {
  error?: string;
}

export async function createCampus(
  _prevState: CampusFormState,
  formData: FormData
): Promise<CampusFormState> {
  const { profile } = await requireProprietor();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name) {
    return { error: "Campus name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("campuses").insert({
    school_id: profile.school_id,
    name,
    address,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the campus list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/campuses");
  return {};
}

export async function renameCampus(formData: FormData) {
  await requireProprietor();
  const campusId = String(formData.get("campus_id"));
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!name) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("campuses")
    .update({ name, address })
    .eq("id", campusId);

  if (error) throw new Error(error.message);
  revalidatePath("/campuses");
}

export async function deleteCampus(campusId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("campuses").delete().eq("id", campusId);
  if (error) throw new Error(error.message);
  revalidatePath("/campuses");
  revalidatePath("/classes");
  revalidatePath("/staff");
}
