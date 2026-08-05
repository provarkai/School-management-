"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { draftText, type DraftResult } from "@/lib/ai/draft";
import { computeClassRanking } from "@/lib/ranking";

export interface ScoreFormState {
  error?: string;
  success?: string;
}

export async function saveScore(
  _prevState: ScoreFormState,
  formData: FormData
): Promise<ScoreFormState> {
  const { profile, school } = await requireUser();

  const studentId = String(formData.get("student_id"));
  const subject = String(formData.get("subject") ?? "").trim();
  const caScore = Number(formData.get("ca_score"));
  const examScore = Number(formData.get("exam_score"));

  if (!subject) return { error: "Subject is required." };
  if (!Number.isFinite(caScore) || caScore < 0 || caScore > 40) {
    return { error: "CA score must be between 0 and 40." };
  }
  if (!Number.isFinite(examScore) || examScore < 0 || examScore > 60) {
    return { error: "Exam score must be between 0 and 60." };
  }

  const supabase = await createClient();

  // Resolve the FK too, so rows written here and rows written by the class
  // grid are indistinguishable downstream — otherwise anything keying off
  // subject_id silently misses scores entered through this form.
  const { data: subjectRow } = await supabase
    .from("subjects")
    .select("id")
    .eq("school_id", profile.school_id ?? "")
    .eq("name", subject)
    .maybeSingle();

  const { data: saved, error } = await supabase
    .from("results")
    .upsert(
      {
        school_id: profile.school_id,
        student_id: studentId,
        subject,
        subject_id: subjectRow?.id ?? null,
        session: school?.current_session ?? "",
        term: school?.current_term ?? "1",
        ca_score: caScore,
        exam_score: examScore,
      },
      { onConflict: "student_id,subject,session,term" }
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  // This form sets the CA and exam totals directly. If the score was
  // previously entered component-by-component in the class grid, those
  // component rows would now sum to something other than the totals just
  // written — so they're cleared rather than left to contradict the result.
  if (saved) {
    await supabase.from("result_component_scores").delete().eq("result_id", saved.id);
  }

  revalidatePath(`/report-cards/${studentId}`);
  return { success: `Saved ${subject}.` };
}

export interface RemarkFormState {
  error?: string;
  success?: string;
}

export async function saveRemarks(
  _prevState: RemarkFormState,
  formData: FormData
): Promise<RemarkFormState> {
  const { profile, school, isManager } = await requireUser();

  const studentId = String(formData.get("student_id"));
  const teacherRemark = String(formData.get("teacher_remark") ?? "").trim();

  const payload: Record<string, unknown> = {
    school_id: profile.school_id,
    student_id: studentId,
    session: school?.current_session ?? "",
    term: school?.current_term ?? "1",
    teacher_remark: teacherRemark || null,
  };

  // Only a manager's submission can touch the principal remark — a crafted
  // request from a non-manager can't smuggle a value in even though the
  // row-level write policy (mirroring results) doesn't distinguish columns.
  if (isManager) {
    const principalRemark = String(formData.get("principal_remark") ?? "").trim();
    payload.principal_remark = principalRemark || null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("report_remarks")
    .upsert(payload, { onConflict: "student_id,session,term" });

  if (error) return { error: error.message };

  revalidatePath(`/report-cards/${studentId}`);
  return { success: "Remarks saved." };
}

/**
 * Drafts a first-pass remark from the student's actual scores and class
 * position this term — the teacher/principal reviews and edits it before
 * saving, same as every other "Draft with AI" button in the app. Nothing is
 * persisted here; saveRemarks (above) is still the only write path.
 */
export async function draftRemark(
  studentId: string,
  kind: "teacher" | "principal"
): Promise<DraftResult> {
  const { profile, school, isManager } = await requireUser();
  if (kind === "principal" && !isManager) {
    return { error: "Only a manager can draft the principal's remark." };
  }

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("full_name, class_id")
    .eq("id", studentId)
    .eq("school_id", profile.school_id ?? "")
    .single();
  if (!student) return { error: "Student not found." };

  const [{ data: results }, ranking] = await Promise.all([
    supabase
      .from("results")
      .select("subject, total, grade")
      .eq("student_id", studentId)
      .eq("session", session)
      .eq("term", term)
      .order("subject"),
    student.class_id
      ? computeClassRanking(supabase, student.class_id, session, term)
      : Promise.resolve(new Map()),
  ]);

  if (!results || results.length === 0) {
    return { error: "No scores recorded for this student yet — enter results before drafting a remark." };
  }

  const position = ranking.get(studentId);
  const average = results.reduce((sum, r) => sum + Number(r.total), 0) / results.length;
  const strongest = [...results].sort((a, b) => Number(b.total) - Number(a.total))[0];
  const weakest = [...results].sort((a, b) => Number(a.total) - Number(b.total))[0];

  const context = [
    `Student: ${student.full_name}`,
    `Term average: ${average.toFixed(1)}%`,
    position ? `Class position: ${position.position} of ${position.outOf}` : null,
    `Strongest subject: ${strongest.subject} (${strongest.total}%, grade ${strongest.grade ?? "—"})`,
    `Subject needing the most support: ${weakest.subject} (${weakest.total}%, grade ${weakest.grade ?? "—"})`,
    `All subjects: ${results.map((r) => `${r.subject} ${r.total}%`).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const audience = kind === "teacher" ? "the class teacher, writing to the parent" : "the school's principal, writing a closing remark for the report card";
  const system = `You draft short, warm, professional report card remarks for a Nigerian school. You are writing as ${audience}. Write 1-2 sentences, encouraging but honest — name a genuine strength and one concrete area to work on, never generic filler. No greeting, no sign-off, just the remark itself.`;

  return draftText(system, `Draft a report card remark based on this data:\n${context}`);
}

export async function deleteScore(resultId: string, studentId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("results").delete().eq("id", resultId);
  if (error) throw new Error(error.message);
  revalidatePath(`/report-cards/${studentId}`);
}
