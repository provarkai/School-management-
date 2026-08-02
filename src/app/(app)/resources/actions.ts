"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ResourceFormState {
  error?: string;
  success?: string;
}

export async function createResource(
  _prevState: ResourceFormState,
  formData: FormData
): Promise<ResourceFormState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const externalUrl = String(formData.get("external_url") ?? "").trim() || null;
  const filePath = String(formData.get("file_path") ?? "").trim() || null;
  const fileName = String(formData.get("file_name") ?? "").trim() || null;

  if (!classId) return { error: "Choose a class." };
  if (!title) return { error: "Enter a title." };
  if (!externalUrl && !filePath) return { error: "Attach a file or a link." };

  const { error } = await supabase.from("learning_resources").insert({
    school_id: profile.school_id,
    class_id: classId,
    subject,
    title,
    description,
    external_url: externalUrl,
    file_path: filePath,
    file_name: fileName,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/resources");
  return { success: "Resource shared." };
}

export async function deleteResource(resourceId: string, filePath: string | null) {
  await requireUser();
  const supabase = await createClient();

  if (filePath) {
    await supabase.storage.from("learning-resources").remove([filePath]);
  }

  const { error } = await supabase.from("learning_resources").delete().eq("id", resourceId);
  if (error) throw new Error(error.message);
  revalidatePath("/resources");
}
