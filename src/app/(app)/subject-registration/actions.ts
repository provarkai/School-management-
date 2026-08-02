"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface RegistrationState {
  error?: string;
  success?: string;
}

/**
 * Saves a whole class's subject combinations in one submit. The form is the
 * complete picture for those students in that session, so this replaces
 * their registrations rather than merging — unticking a box has to actually
 * remove the subject.
 */
export async function saveSubjectRegistrations(
  classId: string,
  _prevState: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  if (!session) return { error: "Set the school's current session first." };

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", profile.school_id ?? "")
    .eq("class_id", classId)
    .eq("status", "active");

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return { error: "No active students in this class." };

  const studentIdSet = new Set(studentIds);
  const rows: { school_id: string | null; student_id: string; subject_id: string; session: string }[] =
    [];

  for (const raw of formData.getAll("reg")) {
    const [studentId, subjectId] = String(raw).split(":");
    // Ignore anything naming a student outside this class — the delete below
    // is scoped to this class, so a stray pair would otherwise be an insert
    // nothing in this form could ever undo.
    if (!studentId || !subjectId || !studentIdSet.has(studentId)) continue;
    rows.push({
      school_id: profile.school_id,
      student_id: studentId,
      subject_id: subjectId,
      session,
    });
  }

  const { error: deleteError } = await supabase
    .from("student_subjects")
    .delete()
    .eq("session", session)
    .in("student_id", studentIds);

  if (deleteError) return { error: deleteError.message };

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("student_subjects").insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/subject-registration");
  return {
    success: `Saved ${rows.length} registration${rows.length === 1 ? "" : "s"} for ${session}.`,
  };
}
