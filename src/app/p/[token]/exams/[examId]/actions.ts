"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export interface SubmitExamState {
  error?: string;
  success?: boolean;
}

export async function submitExamAttempt(
  token: string,
  examId: string,
  _prevState: SubmitExamState,
  formData: FormData
): Promise<SubmitExamState> {
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, class_id, school_id")
    .eq("access_token", token)
    .maybeSingle();

  if (!student) return { error: "This link is no longer valid." };

  const { data: exam } = await supabase
    .from("exams")
    .select("id, class_id, school_id")
    .eq("id", examId)
    .maybeSingle();

  if (!exam || exam.class_id !== student.class_id || exam.school_id !== student.school_id) {
    return { error: "This exam is not available." };
  }

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, submitted_at")
    .eq("exam_id", examId)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!attempt) return { error: "Start the exam before submitting." };
  if (attempt.submitted_at) return { error: "You've already submitted this exam." };

  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id, correct_option, points")
    .eq("exam_id", examId);

  let score = 0;
  let maxScore = 0;
  const answerRows: { attempt_id: string; question_id: string; selected_option: number | null }[] = [];

  for (const q of questions ?? []) {
    maxScore += Number(q.points);
    const raw = formData.get(`answer_${q.id}`);
    const selected = raw !== null && raw !== "" ? Number(raw) : null;
    if (selected !== null && selected === q.correct_option) {
      score += Number(q.points);
    }
    answerRows.push({ attempt_id: attempt.id, question_id: q.id, selected_option: selected });
  }

  if (answerRows.length > 0) {
    const { error: answersError } = await supabase
      .from("exam_answers")
      .upsert(answerRows, { onConflict: "attempt_id,question_id" });
    if (answersError) return { error: answersError.message };
  }

  const { error: updateError } = await supabase
    .from("exam_attempts")
    .update({ submitted_at: new Date().toISOString(), score, max_score: maxScore })
    .eq("id", attempt.id);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/p/${token}/exams/${examId}`);
  return { success: true };
}
