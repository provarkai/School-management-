"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { CustomFieldType } from "@/lib/types";

export interface FieldDefinitionFormState {
  error?: string;
}

export async function createFieldDefinition(
  _prevState: FieldDefinitionFormState,
  formData: FormData
): Promise<FieldDefinitionFormState> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const label = String(formData.get("label") ?? "").trim();
  const fieldType = String(formData.get("field_type") ?? "text") as CustomFieldType;
  const optionsRaw = String(formData.get("options") ?? "").trim();
  const options =
    fieldType === "select"
      ? optionsRaw
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : null;

  if (!label) {
    return { error: "Enter a field label." };
  }
  if (fieldType === "select" && (!options || options.length === 0)) {
    return { error: "Enter at least one option, separated by commas." };
  }

  const { error } = await supabase.from("student_field_definitions").insert({
    school_id: profile.school_id,
    label,
    field_type: fieldType,
    options,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `A field named "${label}" already exists.` };
    }
    return { error: error.message };
  }

  revalidatePath("/students/custom-fields");
  revalidatePath("/students/new");
  return {};
}

export async function deleteFieldDefinition(fieldId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("student_field_definitions").delete().eq("id", fieldId);
  if (error) throw new Error(error.message);
  revalidatePath("/students/custom-fields");
  revalidatePath("/students/new");
}
