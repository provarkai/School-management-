"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { nextAdmissionNumber } from "@/lib/admissionNumber";

export interface ProspectFormState {
  error?: string;
  success?: string;
}

export async function createProspect(
  _prevState: ProspectFormState,
  formData: FormData
): Promise<ProspectFormState> {
  const { profile, school } = await requireProprietor();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null;
  const desiredClass = String(formData.get("desired_class") ?? "").trim() || null;
  const parentName = String(formData.get("parent_name") ?? "").trim() || null;
  const parentPhone = String(formData.get("parent_phone") ?? "").trim() || null;
  const parentEmail = String(formData.get("parent_email") ?? "").trim().toLowerCase() || null;
  const campusId = String(formData.get("campus_id") ?? "").trim() || null;

  if (!fullName) {
    return { error: "Prospect's name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("admission_prospects").insert({
    school_id: profile.school_id,
    campus_id: campusId,
    session: school?.current_session ?? "",
    full_name: fullName,
    date_of_birth: dateOfBirth,
    desired_class: desiredClass,
    parent_name: parentName,
    parent_phone: parentPhone,
    parent_email: parentEmail,
    created_by: profile.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admissions");
  return { success: "Prospect added." };
}

export async function updateProspect(
  prospectId: string,
  _prevState: ProspectFormState,
  formData: FormData
): Promise<ProspectFormState> {
  await requireProprietor();

  const status = String(formData.get("status") ?? "").trim();
  const scoreRaw = String(formData.get("entrance_test_score") ?? "").trim();
  const score = scoreRaw ? Number(scoreRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) {
    return { error: "Test score must be between 0 and 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admission_prospects")
    .update({
      status,
      entrance_test_score: score,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prospectId);

  if (error) return { error: error.message };

  revalidatePath("/admissions");
  return { success: "Updated." };
}

export async function deleteProspect(prospectId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("admission_prospects").delete().eq("id", prospectId);
  if (error) throw new Error(error.message);
  revalidatePath("/admissions");
}

export interface ConvertFormState {
  error?: string;
}

export async function convertProspectToStudent(
  prospectId: string,
  _prevState: ConvertFormState,
  formData: FormData
): Promise<ConvertFormState> {
  const { profile } = await requireProprietor();
  const classId = String(formData.get("class_id") ?? "") || null;

  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("admission_prospects")
    .select("*")
    .eq("id", prospectId)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!prospect) {
    return { error: "Prospect not found." };
  }
  if (prospect.status === "enrolled" && prospect.converted_student_id) {
    return { error: "Already converted to a student." };
  }

  const admissionNumber = await nextAdmissionNumber(supabase, profile.school_id ?? "");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      school_id: profile.school_id,
      class_id: classId,
      full_name: prospect.full_name,
      date_of_birth: prospect.date_of_birth,
      parent_name: prospect.parent_name,
      parent_phone: prospect.parent_phone,
      parent_email: prospect.parent_email,
      admission_number: admissionNumber,
    })
    .select("id")
    .single();

  if (studentError) {
    return { error: studentError.message };
  }

  const { error: updateError } = await supabase
    .from("admission_prospects")
    .update({
      status: "enrolled",
      converted_student_id: student.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prospectId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/admissions");
  revalidatePath("/students");
  return {};
}
