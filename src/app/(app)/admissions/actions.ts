"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor, requirePermission } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { nextAdmissionNumber } from "@/lib/admissionNumber";
import { draftText, type DraftResult } from "@/lib/ai/draft";

export interface ProspectFormState {
  error?: string;
  success?: string;
}

/**
 * Re-fetches the prospect server-side rather than trusting whatever the
 * client currently has rendered — same reasoning as draftRemark
 * (report-cards/actions.ts): a draft is cheap to regenerate but not worth
 * building on stale or tampered data.
 */
async function loadProspectForDraft(prospectId: string) {
  const { profile } = await requirePermission("admissions");
  const supabase = await createClient();
  const { data: prospect } = await supabase
    .from("admission_prospects")
    .select("full_name, desired_class, date_of_birth, entrance_test_score, notes, status")
    .eq("id", prospectId)
    .eq("school_id", profile.school_id ?? "")
    .single();
  return prospect;
}

/** A short internal summary of one applicant — not sent anywhere, just
 * shown to whoever's reviewing the pipeline. */
export async function summarizeProspect(prospectId: string): Promise<DraftResult> {
  const prospect = await loadProspectForDraft(prospectId);
  if (!prospect) return { error: "Prospect not found." };

  const context = [
    `Name: ${prospect.full_name}`,
    prospect.desired_class ? `Applying for: ${prospect.desired_class}` : null,
    prospect.entrance_test_score !== null ? `Entrance test score: ${prospect.entrance_test_score}%` : "No entrance test score recorded yet",
    prospect.notes ? `Notes on file: ${prospect.notes}` : null,
    `Current stage: ${prospect.status}`,
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You summarize a prospective student's admissions file for a school proprietor reviewing their pipeline, in 1-2 plain sentences. State the facts on file and, if a test score is present, whether it looks strong/average/weak — don't invent anything not given.";

  return draftText(system, `Summarize this applicant:\n${context}`);
}

/** Drafts an accept/decline message for a prospect's parent. There's
 * nowhere on admission_prospects to persist this — it's shown in a
 * textarea for the proprietor to copy and send through whatever channel
 * they already use (SMS, WhatsApp, phone call). */
export async function draftAdmissionMessage(
  prospectId: string,
  decision: "accept" | "decline"
): Promise<DraftResult> {
  const prospect = await loadProspectForDraft(prospectId);
  if (!prospect) return { error: "Prospect not found." };

  const context = [
    `Applicant: ${prospect.full_name}`,
    prospect.desired_class ? `Class applied for: ${prospect.desired_class}` : null,
    prospect.entrance_test_score !== null ? `Entrance test score: ${prospect.entrance_test_score}%` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You draft a short, warm message to a prospective student's parent, ${
    decision === "accept" ? "offering the child a place" : "letting them know the child was not offered a place this time"
  }. 2-4 sentences, professional and kind${
    decision === "decline" ? ", without being overly apologetic — just clear and respectful" : ""
  }. No greeting placeholder like "Dear [Name]" — start directly with the message.`;

  return draftText(system, `Draft the message for:\n${context}`);
}

export async function createProspect(
  _prevState: ProspectFormState,
  formData: FormData
): Promise<ProspectFormState> {
  const { profile, school } = await requirePermission("admissions");

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
  await requirePermission("admissions");

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
  await requirePermission("admissions");
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
