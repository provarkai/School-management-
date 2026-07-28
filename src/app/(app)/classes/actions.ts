"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ClassFormState {
  error?: string;
}

export async function createClass(
  _prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const { profile, school } = await requireProprietor();

  const name = String(formData.get("name") ?? "").trim();
  const teacherId = String(formData.get("teacher_id") ?? "") || null;

  if (!name) {
    return { error: "Class name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({
    school_id: profile.school_id,
    name,
    teacher_id: teacherId,
    session: school?.current_session ?? "",
    term: school?.current_term ?? "1",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/classes");
  return {};
}

export async function updateClassTeacher(formData: FormData) {
  await requireProprietor();
  const classId = String(formData.get("class_id"));
  const teacherId = String(formData.get("teacher_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ teacher_id: teacherId })
    .eq("id", classId);

  if (error) throw new Error(error.message);
  revalidatePath("/classes");
}
