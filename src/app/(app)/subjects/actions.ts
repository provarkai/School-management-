"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface SubjectFormState {
  error?: string;
}

export async function createSubject(
  _prevState: SubjectFormState,
  formData: FormData
): Promise<SubjectFormState> {
  const { profile } = await requireProprietor();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Subject name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("subjects").insert({
    school_id: profile.school_id,
    name,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the subject list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/subjects");
  return {};
}

export async function deleteSubject(subjectId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) throw new Error(error.message);
  revalidatePath("/subjects");
}
