"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProprietor, requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { BehaviorCategory, BehaviorSeverity } from "@/lib/types";

export interface StudentFormState {
  error?: string;
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

  if (!fullName) {
    return { error: "Student name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    school_id: profile.school_id,
    full_name: fullName,
    class_id: classId,
    date_of_birth: dateOfBirth,
    parent_name: parentName,
    parent_phone: parentPhone,
    parent_email: parentEmail,
    ...(admissionDate ? { admission_date: admissionDate } : {}),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/students");
  redirect("/students");
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
