"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";
import {
  assessStudentsForPromotion,
  type PromotionCriteria,
  type PromotionDecision,
} from "@/lib/promotionCriteria";

export interface PromotionFormState {
  error?: string;
  success?: string;
}

export async function updatePromotionCriteria(
  _prevState: PromotionFormState,
  formData: FormData
): Promise<PromotionFormState> {
  const { profile } = await requireProprietor();

  const minAverage = Number(formData.get("min_average"));
  const subjectPassMark = Number(formData.get("subject_pass_mark"));
  const maxFailedSubjects = Number(formData.get("max_failed_subjects"));

  if (!Number.isFinite(minAverage) || minAverage < 0 || minAverage > 100) {
    return { error: "Minimum average must be between 0 and 100." };
  }
  if (!Number.isFinite(subjectPassMark) || subjectPassMark < 0 || subjectPassMark > 100) {
    return { error: "Subject pass mark must be between 0 and 100." };
  }
  if (!Number.isInteger(maxFailedSubjects) || maxFailedSubjects < 0) {
    return { error: "Enter how many subjects a student may fail, as a whole number." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({
      promotion_min_average: minAverage,
      promotion_subject_pass_mark: subjectPassMark,
      promotion_max_failed_subjects: maxFailedSubjects,
    })
    .eq("id", profile.school_id ?? "");

  if (error) return { error: error.message };

  revalidatePath("/promotion");
  return { success: "Promotion criteria saved." };
}

interface PromotionLogRow {
  school_id: string;
  student_id: string;
  from_session: string;
  to_session: string;
  from_class_id: string;
  from_class_name: string;
  to_class_id: string | null;
  to_class_name: string | null;
  decision: "promoted" | "repeated" | "graduated";
  average_score: number | null;
  subjects_failed: number | null;
  subjects_counted: number | null;
  overridden: boolean;
  decided_by: string;
}

export async function promoteSession(
  _prevState: PromotionFormState,
  formData: FormData
): Promise<PromotionFormState> {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();
  const schoolId = profile.school_id ?? "";

  const newSession = String(formData.get("new_session") ?? "").trim();
  if (!newSession) {
    return { error: "Enter the new session, e.g. 2026/2027." };
  }

  // Read the outgoing session before it's overwritten below — the promotion
  // log and the criteria both need to know which year is being closed.
  const fromSession = school?.current_session ?? "";

  // Derived from where active students actually sit (class_id), not from a
  // session/term match on the classes table — classes aren't reliably
  // recreated every term, so filtering by the school's current term missed
  // students still sitting in an older-term class row.
  const { data: activeStudents } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId)
    .eq("status", "active");

  const studentsByClass = new Map<string, string[]>();
  for (const s of activeStudents ?? []) {
    if (!s.class_id) continue;
    const bucket = studentsByClass.get(s.class_id) ?? [];
    bucket.push(s.id);
    studentsByClass.set(s.class_id, bucket);
  }

  const classIds = Array.from(studentsByClass.keys());
  if (classIds.length === 0) {
    return { error: "No active students are assigned to a class yet." };
  }

  // Every class the school has, not only the ones holding students — a
  // promotion target has to be matched against classes that are currently
  // empty too, such as the SSS3 whose students graduated last year.
  const { data: allClasses } = await supabase
    .from("classes")
    .select("id, name, teacher_id, campus_id")
    .eq("school_id", schoolId);

  const classes = (allClasses ?? []).filter((c) => classIds.includes(c.id));

  if (classes.length === 0) {
    return { error: "No classes found to promote." };
  }

  // Normalised name -> class id. First one wins if a school somehow has two
  // rows with the same name, so a promotion never adds a third.
  const classesByName = new Map<string, string>();
  for (const c of allClasses ?? []) {
    const key = c.name.trim().toLowerCase();
    if (!classesByName.has(key)) classesByName.set(key, c.id);
  }

  const criteria: PromotionCriteria = {
    minAverage: Number(school?.promotion_min_average ?? 40),
    subjectPassMark: Number(school?.promotion_subject_pass_mark ?? 40),
    maxFailedSubjects: Number(school?.promotion_max_failed_subjects ?? 3),
  };

  // Recomputed here rather than trusted from the form: the page's numbers
  // are only there to inform the choice, and the log should record what the
  // results actually said at the moment of promotion.
  const assessments = await assessStudentsForPromotion(
    supabase,
    schoolId,
    fromSession,
    Array.from(studentsByClass.values()).flat(),
    criteria
  );

  const targetClassIdByName = new Map<string, string>();
  const logs: PromotionLogRow[] = [];
  let createdClasses = 0;
  let promotedStudents = 0;
  let repeatedStudents = 0;
  let graduatedStudents = 0;

  /**
   * The class a promoted or repeating student should land in.
   *
   * A class is a permanent thing — a school has one JSS1 and students move
   * through it year after year. So this reuses the school's existing class
   * of that name and only creates one when the name is genuinely new (a
   * school adding SSS1 for the first time). Creating a fresh row per
   * session instead would leave the school with two JSS1s, two JSS2s and
   * so on after every promotion, each with the timetable, class teacher
   * and attendance history split between them.
   *
   * Matching ignores case and surrounding spaces, so "Jss3" typed one year
   * and "JSS3" the next are the same class rather than two.
   */
  async function ensureClass(
    name: string,
    teacherId: string | null,
    campusId: string | null
  ): Promise<{ id?: string; error?: string }> {
    const key = name.trim().toLowerCase();
    const existing = targetClassIdByName.get(key);
    if (existing) return { id: existing };

    const match = classesByName.get(key);
    if (match) {
      targetClassIdByName.set(key, match);
      return { id: match };
    }

    const { data: newClass, error } = await supabase
      .from("classes")
      .insert({
        school_id: schoolId,
        name,
        teacher_id: teacherId,
        campus_id: campusId,
        session: newSession,
        term: "1",
      })
      .select("id")
      .single();

    if (error || !newClass?.id) {
      return { error: `Could not create "${name}": ${error?.message ?? "no id returned"}` };
    }

    targetClassIdByName.set(key, newClass.id);
    classesByName.set(key, newClass.id);
    createdClasses++;
    return { id: newClass.id };
  }

  for (const c of classes) {
    const studentIds = studentsByClass.get(c.id) ?? [];
    if (studentIds.length === 0) continue;

    const logFor = (
      studentId: string,
      decision: PromotionLogRow["decision"],
      toClassId: string | null,
      toClassName: string | null,
      overridden: boolean
    ): PromotionLogRow => {
      const a = assessments.get(studentId);
      return {
        school_id: schoolId,
        student_id: studentId,
        from_session: fromSession,
        to_session: newSession,
        from_class_id: c.id,
        from_class_name: c.name,
        to_class_id: toClassId,
        to_class_name: toClassName,
        decision,
        average_score: a?.average ?? null,
        subjects_failed: a?.subjectsCounted ? a.subjectsFailed : null,
        subjects_counted: a?.subjectsCounted ?? null,
        overridden,
        decided_by: profile.id,
      };
    };

    if (formData.get(`graduate_${c.id}`) === "on") {
      const { error } = await supabase
        .from("students")
        .update({ status: "graduated" })
        .in("id", studentIds);
      if (error) return { error: error.message };
      graduatedStudents += studentIds.length;
      for (const id of studentIds) logs.push(logFor(id, "graduated", null, null, false));
      continue;
    }

    const targetName = String(formData.get(`target_${c.id}`) ?? "").trim();
    if (!targetName) continue;

    const promoting: string[] = [];
    const repeating: string[] = [];
    for (const id of studentIds) {
      const decision = (String(formData.get(`decision_${id}`) ?? "promote") ===
        "repeat"
        ? "repeat"
        : "promote") as PromotionDecision;
      (decision === "repeat" ? repeating : promoting).push(id);
    }

    if (promoting.length > 0) {
      const target = await ensureClass(targetName, c.teacher_id, c.campus_id);
      if (target.error || !target.id) return { error: target.error ?? "Could not create class." };

      const { error } = await supabase
        .from("students")
        .update({ class_id: target.id })
        .in("id", promoting);
      if (error) return { error: error.message };

      promotedStudents += promoting.length;
      for (const id of promoting) {
        logs.push(
          logFor(id, "promoted", target.id, targetName, assessments.get(id)?.recommendation === "repeat")
        );
      }
    }

    if (repeating.length > 0) {
      // A repeater stays in the same class *name*, but in the new session's
      // row for it — otherwise they'd be left pointing at last year's class.
      const repeatClass = await ensureClass(c.name, c.teacher_id, c.campus_id);
      if (repeatClass.error || !repeatClass.id) {
        return { error: repeatClass.error ?? "Could not create class." };
      }

      const { error } = await supabase
        .from("students")
        .update({ class_id: repeatClass.id })
        .in("id", repeating);
      if (error) return { error: error.message };

      repeatedStudents += repeating.length;
      for (const id of repeating) {
        logs.push(
          logFor(id, "repeated", repeatClass.id, c.name, assessments.get(id)?.recommendation === "promote")
        );
      }
    }
  }

  if (logs.length > 0) {
    // Best-effort: the students have already moved, so a failure to write
    // the history shouldn't present the whole promotion as failed.
    await supabase.from("student_promotions").insert(logs);
  }

  // Classes carry the session they're currently running, and pages that
  // list classes filter on it. Every class moves to the new session — not
  // just the ones that received students — so a class left empty by
  // graduation (SSS3) or waiting on new intake (JSS1) still shows up,
  // ready to be filled.
  const { error: classSessionError } = await supabase
    .from("classes")
    .update({ session: newSession, term: "1" })
    .eq("school_id", schoolId);

  if (classSessionError) return { error: classSessionError.message };

  const { error: schoolError } = await supabase
    .from("schools")
    .update({ current_session: newSession, current_term: "1" })
    .eq("id", schoolId);

  if (schoolError) return { error: schoolError.message };

  revalidatePath("/promotion");
  revalidatePath("/classes");
  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  const parts = [`Promoted ${promotedStudents} student${promotedStudents === 1 ? "" : "s"}`];
  if (repeatedStudents > 0) parts.push(`held ${repeatedStudents} back to repeat`);
  if (graduatedStudents > 0) parts.push(`graduated ${graduatedStudents}`);
  if (createdClasses > 0) {
    parts.push(`created ${createdClasses} new class${createdClasses === 1 ? "" : "es"}`);
  }

  await logActivity(
    supabase,
    profile,
    "session_promoted",
    `Ran session promotion from ${fromSession} to ${newSession}: ${parts.join(", ")}.`
  );

  return { success: `${parts.join(", ")} for ${newSession}. That's now the active session.` };
}
