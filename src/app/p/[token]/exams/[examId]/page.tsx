import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { ExamForm } from "./ExamForm";

export const dynamic = "force-dynamic";

export default async function PublicExamPage({
  params,
}: {
  params: Promise<{ token: string; examId: string }>;
}) {
  const { token, examId } = await params;
  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, class_id, school_id")
    .eq("access_token", token)
    .maybeSingle();

  if (!student) notFound();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, subject, duration_minutes, status, class_id, school_id")
    .eq("id", examId)
    .maybeSingle();

  if (!exam || exam.class_id !== student.class_id || exam.school_id !== student.school_id) {
    notFound();
  }

  let { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, started_at, submitted_at, score, max_score")
    .eq("exam_id", examId)
    .eq("student_id", student.id)
    .maybeSingle();

  if (!attempt) {
    if (exam.status !== "published") {
      return (
        <div className="mx-auto min-h-screen max-w-lg space-y-4 bg-zinc-50 px-4 py-8">
          <Link href={`/p/${token}`} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            ← Back
          </Link>
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
            This exam isn&rsquo;t available right now.
          </p>
        </div>
      );
    }

    const { data: created } = await supabase
      .from("exam_attempts")
      .insert({ exam_id: examId, student_id: student.id })
      .select("id, started_at, submitted_at, score, max_score")
      .single();
    attempt = created;
  }

  if (!attempt) notFound();

  if (attempt.submitted_at) {
    const { data: questions } = await supabase
      .from("exam_questions")
      .select("id, position, question_text, options, correct_option, points")
      .eq("exam_id", examId)
      .order("position");

    const { data: answers } = await supabase
      .from("exam_answers")
      .select("question_id, selected_option")
      .eq("attempt_id", attempt.id);

    const answerByQuestion = new Map((answers ?? []).map((a) => [a.question_id, a.selected_option]));

    return (
      <div className="mx-auto min-h-screen max-w-lg space-y-4 bg-zinc-50 px-4 py-8">
        <Link href={`/p/${token}`} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← Back
        </Link>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{exam.title}</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">
            {attempt.score}/{attempt.max_score}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Submitted {attempt.submitted_at.slice(0, 10)}</p>
        </div>

        <div className="space-y-3">
          {(questions ?? []).map((q, i) => {
            const options = q.options as unknown as string[];
            const selected = answerByQuestion.get(q.id) ?? null;
            const correct = selected === q.correct_option;
            return (
              <div key={q.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-sm font-medium text-zinc-900">
                  {i + 1}. {q.question_text}
                </p>
                <ul className="space-y-1 text-sm">
                  {options.map((opt, idx) => {
                    const isCorrect = idx === q.correct_option;
                    const isSelected = idx === selected;
                    return (
                      <li
                        key={idx}
                        className={
                          isCorrect
                            ? "font-medium text-emerald-700"
                            : isSelected
                              ? "font-medium text-red-600"
                              : "text-zinc-500"
                        }
                      >
                        {isCorrect ? "✓ " : isSelected ? "✗ " : "· "}
                        {opt}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-xs text-zinc-400">
                  {correct ? q.points : 0}/{q.points} point{Number(q.points) === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const { data: questionRows } = await supabase
    .from("exam_questions")
    .select("id, position, question_text, options")
    .eq("exam_id", examId)
    .order("position");

  const questions = (questionRows ?? []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    options: q.options as unknown as string[],
  }));

  const deadline = new Date(
    new Date(attempt.started_at).getTime() + exam.duration_minutes * 60_000
  ).toISOString();

  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-4 bg-zinc-50 px-4 py-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {student.full_name}
        </p>
        <h1 className="mt-1 text-xl font-bold text-zinc-900">{exam.title}</h1>
        {exam.subject && <p className="text-sm text-zinc-500">{exam.subject}</p>}
      </div>

      {questions.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
          This exam has no questions yet.
        </p>
      ) : (
        <ExamForm token={token} examId={examId} questions={questions} deadline={deadline} />
      )}
    </div>
  );
}
