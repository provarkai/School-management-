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

export async function deleteScore(resultId: string, studentId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("results").delete().eq("id", resultId);
  if (error) throw new Error(error.message);
  revalidatePath(`/report-cards/${studentId}`);
}
