"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface ExamFormState {
  error?: string;
}

export async function createExam(
  _prevState: ExamFormState,
  formData: FormData
): Promise<ExamFormState> {
  const { profile, school } = await requireUser();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes"));

  if (!classId) return { error: "Choose a class." };
  if (!title) return { error: "Enter a title." };
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Enter a valid duration in minutes." };
  }

  const { error } = await supabase.from("exams").insert({
    school_id: profile.school_id,
    class_id: classId,
    subject,
    title,
    session: school?.current_session ?? "",
    term: school?.current_term ?? "1",
    duration_minutes: Math.round(durationMinutes),
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/exams");
  return {};
}

export async function deleteExam(examId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("exams").delete().eq("id", examId);
  if (error) throw new Error(error.message);
  revalidatePath("/exams");
}

export async function updateExamStatus(examId: string, status: "published" | "closed") {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("exams").update({ status }).eq("id", examId);
  if (error) throw new Error(error.message);
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
}

export interface QuestionFormState {
  error?: string;
}

export async function addQuestion(
  examId: string,
  _prevState: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  await requireUser();
  const supabase = await createClient();

  const questionText = String(formData.get("question_text") ?? "").trim();
  const options = [1, 2, 3, 4]
    .map((n) => String(formData.get(`option_${n}`) ?? "").trim())
    .filter(Boolean);
  const correctOption = Number(formData.get("correct_option"));
  const points = Number(formData.get("points") ?? 1);

  if (!questionText) return { error: "Enter the question." };
  if (options.length < 2) return { error: "Enter at least 2 options." };
  if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
    return { error: "Choose which option is correct." };
  }
  if (!Number.isFinite(points) || points <= 0) return { error: "Enter a valid point value." };

  const { data: existing } = await supabase
    .from("exam_questions")
    .select("position")
    .eq("exam_id", examId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("exam_questions").insert({
    exam_id: examId,
    position: (existing?.position ?? -1) + 1,
    question_text: questionText,
    options,
    correct_option: correctOption,
    points,
  });

  if (error) return { error: error.message };

  revalidatePath(`/exams/${examId}`);
  return {};
}

export async function deleteQuestion(questionId: string, examId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("exam_questions").delete().eq("id", questionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/exams/${examId}`);
}
