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

export interface PushScoresState {
  error?: string;
  success?: string;
}

/**
 * Copies an exam's auto-graded scores into the `results` table so they flow
 * through to report cards, instead of a teacher re-typing every one.
 *
 * `results` splits a subject into ca_score (out of 40) and exam_score (out
 * of 60), while an attempt is a single number out of max_score — so the
 * teacher picks which half this exam fills, and the score is scaled into it.
 */
export async function pushExamScores(
  examId: string,
  _prevState: PushScoresState,
  formData: FormData
): Promise<PushScoresState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const subject = String(formData.get("subject") ?? "").trim();
  const slot = String(formData.get("slot") ?? "");

  if (!subject) return { error: "Choose the subject these scores belong to." };
  if (slot !== "ca" && slot !== "exam") return { error: "Choose CA or Exam." };

  const slotMax = slot === "ca" ? 40 : 60;

  const { data: exam } = await supabase
    .from("exams")
    .select("id, session, term")
    .eq("id", examId)
    .single();

  if (!exam) return { error: "Exam not found." };

  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("student_id, score, max_score")
    .eq("exam_id", examId)
    .not("submitted_at", "is", null);

  // Students who never sat the exam are skipped rather than written as a
  // zero — an absent student isn't the same as one who scored nothing.
  const scored = (attempts ?? []).filter(
    (a) => a.score !== null && a.max_score !== null && Number(a.max_score) > 0
  );

  if (scored.length === 0) {
    return { error: "No submitted attempts to push yet." };
  }

  const studentIds = scored.map((a) => a.student_id);

  // Read-merge-write rather than a partial upsert: the other half of the
  // subject's score may already have been entered by hand, and it must
  // survive this push untouched.
  const { data: existing } = await supabase
    .from("results")
    .select("student_id, ca_score, exam_score")
    .eq("school_id", profile.school_id ?? "")
    .eq("subject", subject)
    .eq("session", exam.session)
    .eq("term", exam.term)
    .in("student_id", studentIds);

  const existingByStudent = new Map((existing ?? []).map((r) => [r.student_id, r]));

  const rows = scored.map((a) => {
    const scaled = Math.round((Number(a.score) / Number(a.max_score)) * slotMax * 100) / 100;
    const prior = existingByStudent.get(a.student_id);
    return {
      school_id: profile.school_id,
      student_id: a.student_id,
      subject,
      session: exam.session,
      term: exam.term,
      ca_score: slot === "ca" ? scaled : Number(prior?.ca_score ?? 0),
      exam_score: slot === "exam" ? scaled : Number(prior?.exam_score ?? 0),
    };
  });

  const { error } = await supabase
    .from("results")
    .upsert(rows, { onConflict: "student_id,subject,session,term" });

  if (error) return { error: error.message };

  revalidatePath(`/exams/${examId}`);
  revalidatePath("/report-cards");

  return {
    success: `Pushed ${rows.length} score${rows.length === 1 ? "" : "s"} into ${subject} (${
      slot === "ca" ? "CA" : "Exam"
    }).`,
  };
}
