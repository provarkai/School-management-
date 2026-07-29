"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { requireProprietor } from "@/lib/current-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface AddTeacherState {
  error?: string;
  tempPassword?: string;
}

export async function addTeacher(
  _prevState: AddTeacherState,
  formData: FormData
): Promise<AddTeacherState> {
  const { profile } = await requireProprietor();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  if (!name || !email) {
    return { error: "Name and email are required." };
  }

  const tempPassword = randomBytes(9).toString("base64url");
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Could not create staff account." };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("app_users")
    .update({
      school_id: profile.school_id,
      role: "teacher",
      name,
      phone: phone || null,
      subject: subject || null,
    })
    .eq("id", created.user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  revalidatePath("/staff");
  return { tempPassword };
}

export async function updateTeacherSubject(formData: FormData) {
  await requireProprietor();
  const teacherId = String(formData.get("teacher_id"));
  const subject = String(formData.get("subject") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update({ subject }).eq("id", teacherId);

  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}

export async function assignClassTeacher(classId: string, teacherId: string | null) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({ teacher_id: teacherId })
    .eq("id", classId);

  if (error) throw new Error(error.message);
  revalidatePath("/classes");
}
