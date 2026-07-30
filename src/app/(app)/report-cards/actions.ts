"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.from("results").upsert(
    {
      school_id: profile.school_id,
      student_id: studentId,
      subject,
      session: school?.current_session ?? "",
      term: school?.current_term ?? "1",
      ca_score: caScore,
      exam_score: examScore,
    },
    { onConflict: "student_id,subject,session,term" }
  );

  if (error) return { error: error.message };

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

export async function deleteScore(resultId: string, studentId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("results").delete().eq("id", resultId);
  if (error) throw new Error(error.message);
  revalidatePath(`/report-cards/${studentId}`);
}
