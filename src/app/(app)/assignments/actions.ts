"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface AssignmentFormState {
  error?: string;
  success?: string;
}

export async function createAssignment(
  _prevState: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueDate = String(formData.get("due_date") ?? "");

  if (!classId) return { error: "Choose a class." };
  if (!title) return { error: "Enter a title." };
  if (!dueDate) return { error: "Choose a due date." };

  const { error } = await supabase.from("assignments").insert({
    school_id: profile.school_id,
    class_id: classId,
    subject,
    title,
    description,
    due_date: dueDate,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  return { success: "Assignment posted." };
}

export async function deleteAssignment(assignmentId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
  revalidatePath("/assignments");
}
