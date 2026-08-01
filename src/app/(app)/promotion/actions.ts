"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface PromotionFormState {
  error?: string;
  success?: string;
}

export async function promoteSession(
  _prevState: PromotionFormState,
  formData: FormData
): Promise<PromotionFormState> {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const newSession = String(formData.get("new_session") ?? "").trim();
  if (!newSession) {
    return { error: "Enter the new session, e.g. 2026/2027." };
  }

  const currentSession = school?.current_session ?? "";
  const currentTerm = school?.current_term ?? "1";

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, teacher_id, campus_id")
    .eq("school_id", profile.school_id ?? "")
    .eq("session", currentSession)
    .eq("term", currentTerm);

  if (!classes || classes.length === 0) {
    return { error: "No classes found for the current term to promote." };
  }

  const targetClassIdByName = new Map<string, string>();
  let promotedClasses = 0;
  let promotedStudents = 0;
  let graduatedStudents = 0;

  for (const c of classes) {
    const graduate = formData.get(`graduate_${c.id}`) === "on";

    if (graduate) {
      const { data: updated, error } = await supabase
        .from("students")
        .update({ status: "graduated" })
        .eq("class_id", c.id)
        .eq("status", "active")
        .select("id");
      if (error) return { error: error.message };
      graduatedStudents += updated?.length ?? 0;
      continue;
    }

    const targetName = String(formData.get(`target_${c.id}`) ?? "").trim();
    if (!targetName) continue;

    let targetClassId = targetClassIdByName.get(targetName);
    if (!targetClassId) {
      const { data: newClass, error: classError } = await supabase
        .from("classes")
        .insert({
          school_id: profile.school_id,
          name: targetName,
          teacher_id: c.teacher_id,
          campus_id: c.campus_id,
          session: newSession,
          term: "1",
        })
        .select("id")
        .single();

      if (classError || !newClass) {
        return { error: `Could not create "${targetName}": ${classError?.message ?? "unknown error"}` };
      }
      targetClassId = newClass.id;
      if (!targetClassId) {
        return { error: `Could not create "${targetName}": no id returned.` };
      }
      targetClassIdByName.set(targetName, targetClassId);
      promotedClasses++;
    }

    const { data: moved, error: moveError } = await supabase
      .from("students")
      .update({ class_id: targetClassId })
      .eq("class_id", c.id)
      .eq("status", "active")
      .select("id");

    if (moveError) return { error: moveError.message };
    promotedStudents += moved?.length ?? 0;
  }

  const { error: schoolError } = await supabase
    .from("schools")
    .update({ current_session: newSession, current_term: "1" })
    .eq("id", profile.school_id ?? "");

  if (schoolError) return { error: schoolError.message };

  revalidatePath("/promotion");
  revalidatePath("/classes");
  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  const parts = [`Promoted ${promotedStudents} student${promotedStudents === 1 ? "" : "s"} into ${promotedClasses} class${promotedClasses === 1 ? "" : "es"}`];
  if (graduatedStudents > 0) parts.push(`graduated ${graduatedStudents}`);

  return { success: `${parts.join(", ")} for ${newSession}. That's now the active session.` };
}
