"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { requireProprietor, requireLiteralProprietor } from "@/lib/current-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";

export interface AddTeacherState {
  error?: string;
  tempPassword?: string;
}

export async function addStaffMember(
  _prevState: AddTeacherState,
  formData: FormData
): Promise<AddTeacherState> {
  const { profile } = await requireProprietor();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const role = String(formData.get("role") ?? "teacher") === "staff" ? "staff" : "teacher";
  const subject = String(formData.get("subject") ?? "").trim();
  const jobTitle = String(formData.get("job_title") ?? "").trim();
  const campusId = String(formData.get("campus_id") ?? "").trim() || null;

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

  // The on_auth_user_created trigger just inserted this row with
  // school_id null (it has no way to know which school), and the
  // app_users_select/update RLS policies require school_id to already
  // match current_school_id() — a null school_id never matches, so a
  // session-bound client here silently updates zero rows (no error, but
  // the new staff member's account is never actually linked to the
  // school). The admin client bypasses RLS, same as the trigger itself.
  const { error: profileError } = await admin
    .from("app_users")
    .update({
      school_id: profile.school_id,
      role,
      name,
      phone: phone || null,
      subject: role === "teacher" ? subject || null : null,
      job_title: role === "staff" ? jobTitle || null : null,
      campus_id: campusId,
    })
    .eq("id", created.user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  const supabase = await createClient();
  await logActivity(
    supabase,
    profile,
    "staff_created",
    `Added ${name} as ${role === "teacher" ? "a teacher" : "a staff member"}.`
  );

  revalidatePath("/staff");
  return { tempPassword };
}

export interface StaffImportRow {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  subject?: string;
  job_title?: string;
  campus_name?: string;
}

export interface StaffImportResult {
  error?: string;
  imported?: number;
  skipped?: { row: number; reason: string }[];
  credentials?: { row: number; name: string; email: string; tempPassword: string }[];
}

export async function bulkImportStaff(rows: StaffImportRow[]): Promise<StaffImportResult> {
  const { profile } = await requireProprietor();

  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: campuses } = await supabase
    .from("campuses")
    .select("id, name")
    .eq("school_id", profile.school_id ?? "");
  const campusByName = new Map((campuses ?? []).map((c) => [c.name.trim().toLowerCase(), c.id]));

  const skipped: { row: number; reason: string }[] = [];
  const credentials: { row: number; name: string; email: string; tempPassword: string }[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2;
    const name = row.name?.trim();
    const email = row.email?.trim().toLowerCase();
    const role = String(row.role ?? "teacher").trim().toLowerCase() === "staff" ? "staff" : "teacher";

    if (!name || !email) {
      skipped.push({ row: rowNumber, reason: "Missing name or email" });
      continue;
    }

    let campusId: string | null = null;
    if (row.campus_name?.trim()) {
      campusId = campusByName.get(row.campus_name.trim().toLowerCase()) ?? null;
      if (!campusId) {
        skipped.push({ row: rowNumber, reason: `Unknown campus "${row.campus_name}"` });
        continue;
      }
    }

    const tempPassword = randomBytes(9).toString("base64url");
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError || !created.user) {
      skipped.push({ row: rowNumber, reason: createError?.message ?? "Could not create account" });
      continue;
    }

    // Same reasoning as addStaffMember: the trigger-created row has
    // school_id null, so this update must bypass RLS via the admin client
    // or it silently affects zero rows.
    const { error: profileError } = await admin
      .from("app_users")
      .update({
        school_id: profile.school_id,
        role,
        name,
        phone: row.phone?.trim() || null,
        subject: role === "teacher" ? row.subject?.trim() || null : null,
        job_title: role === "staff" ? row.job_title?.trim() || null : null,
        campus_id: campusId,
      })
      .eq("id", created.user.id);

    if (profileError) {
      skipped.push({ row: rowNumber, reason: profileError.message });
      continue;
    }

    credentials.push({ row: rowNumber, name, email, tempPassword });
  }

  if (credentials.length > 0) {
    revalidatePath("/staff");
  }

  if (credentials.length === 0) {
    return { error: "No staff were imported.", skipped };
  }

  return { imported: credentials.length, skipped, credentials };
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

export async function updateStaffJobTitle(formData: FormData) {
  await requireProprietor();
  const staffId = String(formData.get("staff_id"));
  const jobTitle = String(formData.get("job_title") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("app_users").update({ job_title: jobTitle }).eq("id", staffId);

  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}

export async function updateTeacherCampus(formData: FormData) {
  await requireProprietor();
  const teacherId = String(formData.get("teacher_id"));
  const campusId = String(formData.get("campus_id") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ campus_id: campusId })
    .eq("id", teacherId);

  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}

export async function setSchoolAdmin(staffId: string, isAdmin: boolean) {
  const { profile } = await requireLiteralProprietor();
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("app_users")
    .select("name")
    .eq("id", staffId)
    .single();

  const { error } = await supabase
    .from("app_users")
    .update({ is_school_admin: isAdmin })
    .eq("id", staffId);

  if (error) throw new Error(error.message);

  await logActivity(
    supabase,
    profile,
    isAdmin ? "admin_granted" : "admin_revoked",
    `${isAdmin ? "Granted" : "Revoked"} admin rights ${isAdmin ? "to" : "from"} ${staff?.name ?? "a staff member"}.`
  );

  revalidatePath("/staff");
}
