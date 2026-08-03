"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProprietor, requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { BehaviorCategory, BehaviorSeverity } from "@/lib/types";

export interface StudentFormState {
  error?: string;
}

export async function saveStudentPhoto(studentId: string, url: string): Promise<void> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({ photo_url: url })
    .eq("id", studentId)
    .eq("school_id", profile.school_id ?? "");

  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
}

export interface StudentRecordState {
  error?: string;
  success?: string;
}

/** Extended student record — identity, contact and medical details that
 * don't fit the create form but matter for ID cards, transfer certificates
 * and emergencies. */
export async function updateStudentRecord(
  studentId: string,
  _prevState: StudentRecordState,
  formData: FormData
): Promise<StudentRecordState> {
  const { profile } = await requireProprietor();

  const gender = String(formData.get("gender") ?? "").trim() || null;
  if (gender !== null && gender !== "male" && gender !== "female") {
    return { error: "Choose a valid gender." };
  }

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      admission_number: text("admission_number"),
      gender,
      address: text("address"),
      guardian_name: text("guardian_name"),
      guardian_phone: text("guardian_phone"),
      guardian_relationship: text("guardian_relationship"),
      blood_group: text("blood_group"),
      genotype: text("genotype"),
      allergies: text("allergies"),
      emergency_contact_name: text("emergency_contact_name"),
      emergency_contact_phone: text("emergency_contact_phone"),
    })
    .eq("id", studentId)
    .eq("school_id", profile.school_id ?? "");

  if (error) {
    if (error.code === "23505") {
      return { error: "That admission number is already in use by another student." };
    }
    return { error: error.message };
  }

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { success: "Record updated." };
}

export interface WithdrawalState {
  error?: string;
  success?: string;
}

/** Marks a student withdrawn and records what a transfer certificate needs
 * to say. Only ever moves active -> withdrawn: re-admitting a withdrawn
 * student, or editing the record afterwards, isn't handled here — treat a
 * mistaken withdrawal as a support request rather than a self-service undo,
 * since it also unlocks generating an official-looking certificate. */
export async function withdrawStudent(
  studentId: string,
  _prevState: WithdrawalState,
  formData: FormData
): Promise<WithdrawalState> {
  const { profile } = await requireProprietor();

  const withdrawnAt = String(formData.get("withdrawn_at") ?? "").trim();
  if (!withdrawnAt) {
    return { error: "Enter the date the student left." };
  }

  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({
      status: "withdrawn",
      withdrawn_at: withdrawnAt,
      withdrawal_reason: text("withdrawal_reason"),
      conduct_remark: text("conduct_remark"),
    })
    .eq("id", studentId)
    .eq("school_id", profile.school_id ?? "")
    .eq("status", "active")
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "This student is not currently active." };
  }

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  revalidatePath("/transfer-certificates");
  return { success: "Student marked as withdrawn. The transfer certificate is ready below." };
}

export async function createStudent(
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const { profile } = await requireProprietor();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const classId = String(formData.get("class_id") ?? "") || null;
  const dateOfBirth = String(formData.get("date_of_birth") ?? "") || null;
  const parentName = String(formData.get("parent_name") ?? "").trim() || null;
  const parentPhone = String(formData.get("parent_phone") ?? "").trim() || null;
  const parentEmail = String(formData.get("parent_email") ?? "").trim().toLowerCase() || null;
  const admissionDate = String(formData.get("admission_date") ?? "") || undefined;
  const admissionNumber = String(formData.get("admission_number") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

  if (!fullName) {
    return { error: "Student name is required." };
  }
  if (gender !== null && gender !== "male" && gender !== "female") {
    return { error: "Choose a valid gender." };
  }

  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("students")
    .insert({
      school_id: profile.school_id,
      full_name: fullName,
      class_id: classId,
      date_of_birth: dateOfBirth,
      parent_name: parentName,
      parent_phone: parentPhone,
      parent_email: parentEmail,
      admission_number: admissionNumber,
      gender,
      address,
      ...(admissionDate ? { admission_date: admissionDate } : {}),
    })
    .select("id")
    .single();

  if (error) {
    // The partial unique index on (school_id, admission_number) is the most
    // likely thing a proprietor trips here, and the raw Postgres text is
    // unreadable.
    if (error.code === "23505" && admissionNumber) {
      return { error: `Admission number "${admissionNumber}" is already in use.` };
    }
    return { error: error.message };
  }

  const { data: fieldDefs } = await supabase
    .from("student_field_definitions")
    .select("id")
    .eq("school_id", profile.school_id ?? "");

  const fieldValues = (fieldDefs ?? [])
    .map((def) => ({
      school_id: profile.school_id,
      student_id: student.id,
      field_definition_id: def.id,
      value: String(formData.get(`field_${def.id}`) ?? "").trim() || null,
    }))
    .filter((row) => row.value !== null);

  if (fieldValues.length > 0) {
    await supabase.from("student_field_values").insert(fieldValues);
  }

  revalidatePath("/students");
  redirect("/students");
}

export interface StudentFieldValuesState {
  error?: string;
  success?: string;
}

export async function setStudentFieldValues(
  studentId: string,
  _prevState: StudentFieldValuesState,
  formData: FormData
): Promise<StudentFieldValuesState> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: fieldDefs } = await supabase
    .from("student_field_definitions")
    .select("id")
    .eq("school_id", profile.school_id ?? "");

  const rows = (fieldDefs ?? []).map((def) => ({
    school_id: profile.school_id,
    student_id: studentId,
    field_definition_id: def.id,
    value: String(formData.get(`field_${def.id}`) ?? "").trim() || null,
  }));

  const { error } = await supabase
    .from("student_field_values")
    .upsert(rows, { onConflict: "student_id,field_definition_id" });

  if (error) return { error: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: "Custom fields saved." };
}

export interface ImportRow {
  full_name: string;
  class_name?: string;
  date_of_birth?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  admission_date?: string;
}

export interface ImportResult {
  error?: string;
  imported?: number;
  skipped?: { row: number; reason: string }[];
}

export async function bulkImportStudents(rows: ImportRow[]): Promise<ImportResult> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "");

  const classByName = new Map(
    (classes ?? []).map((c) => [c.name.trim().toLowerCase(), c.id])
  );

  const toInsert: Record<string, unknown>[] = [];
  const skipped: { row: number; reason: string }[] = [];

  rows.forEach((row, index) => {
    const fullName = row.full_name?.trim();
    if (!fullName) {
      skipped.push({ row: index + 2, reason: "Missing full_name" });
      return;
    }

    let classId: string | null = null;
    if (row.class_name?.trim()) {
      classId = classByName.get(row.class_name.trim().toLowerCase()) ?? null;
      if (!classId) {
        skipped.push({ row: index + 2, reason: `Unknown class "${row.class_name}"` });
        return;
      }
    }

    toInsert.push({
      school_id: profile.school_id,
      full_name: fullName,
      class_id: classId,
      date_of_birth: row.date_of_birth || null,
      parent_name: row.parent_name?.trim() || null,
      parent_phone: row.parent_phone?.trim() || null,
      parent_email: row.parent_email?.trim().toLowerCase() || null,
      ...(row.admission_date ? { admission_date: row.admission_date } : {}),
    });
  });

  if (toInsert.length === 0) {
    return { error: "No valid rows to import.", skipped };
  }

  const { error } = await supabase.from("students").insert(toInsert);
  if (error) {
    return { error: error.message, skipped };
  }

  revalidatePath("/students");
  return { imported: toInsert.length, skipped };
}

export interface ParentEmailFormState {
  error?: string;
  ok?: boolean;
}

export async function updateParentEmail(
  studentId: string,
  _prevState: ParentEmailFormState,
  formData: FormData
): Promise<ParentEmailFormState> {
  await requireProprietor();

  const parentEmail = String(formData.get("parent_email") ?? "").trim().toLowerCase() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ parent_email: parentEmail })
    .eq("id", studentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export interface BehaviorIncidentFormState {
  error?: string;
  success?: string;
}

export async function createBehaviorIncident(
  studentId: string,
  _prevState: BehaviorIncidentFormState,
  formData: FormData
): Promise<BehaviorIncidentFormState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const category = String(formData.get("category") ?? "") as BehaviorCategory;
  const severity = String(formData.get("severity") ?? "minor") as BehaviorSeverity;
  const description = String(formData.get("description") ?? "").trim();
  const actionTaken = String(formData.get("action_taken") ?? "").trim() || null;
  const incidentDate = String(formData.get("incident_date") ?? "") || undefined;

  if (category !== "merit" && category !== "demerit") {
    return { error: "Choose merit or demerit." };
  }
  if (!description) {
    return { error: "Enter a description." };
  }

  const { error } = await supabase.from("behavior_incidents").insert({
    school_id: profile.school_id,
    student_id: studentId,
    category,
    severity,
    description,
    action_taken: actionTaken,
    recorded_by: profile.id,
    ...(incidentDate ? { incident_date: incidentDate } : {}),
  });

  if (error) return { error: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: "Incident logged." };
}

export async function deleteBehaviorIncident(studentId: string, incidentId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("behavior_incidents").delete().eq("id", incidentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
}

export interface DocumentUploadState {
  error?: string;
  success?: string;
}

export async function recordStudentDocument(
  studentId: string,
  _prevState: DocumentUploadState,
  formData: FormData
): Promise<DocumentUploadState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const label = String(formData.get("label") ?? "").trim();
  const filePath = String(formData.get("file_path") ?? "").trim();
  const fileName = String(formData.get("file_name") ?? "").trim();
  const contentType = String(formData.get("content_type") ?? "").trim() || null;
  const sizeBytes = Number(formData.get("size_bytes") ?? 0) || null;

  if (!label) return { error: "Enter a label for this document." };
  if (!filePath || !fileName) return { error: "Upload failed — no file received." };

  const { error } = await supabase.from("student_documents").insert({
    school_id: profile.school_id,
    student_id: studentId,
    label,
    file_path: filePath,
    file_name: fileName,
    content_type: contentType,
    size_bytes: sizeBytes,
    uploaded_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: "Document uploaded." };
}

export async function deleteStudentDocument(studentId: string, documentId: string, filePath: string) {
  await requireProprietor();
  const supabase = await createClient();
  await supabase.storage.from("student-documents").remove([filePath]);
  const { error } = await supabase.from("student_documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/students/${studentId}`);
}
