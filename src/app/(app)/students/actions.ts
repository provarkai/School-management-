"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

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
