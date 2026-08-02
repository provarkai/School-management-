import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "./QuestionForm";
import { DeleteQuestionButton } from "./DeleteQuestionButton";
import { StatusButtons } from "./StatusButtons";

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, subject, duration_minutes, status, class_id, classes(name)")
    .eq("id", examId)
    .single();

  if (!exam) notFound();

  const className = (exam.classes as unknown as { name: string } | null)?.name ?? "—";

  const [{ data: questions }, { data: attemptRows }] = await Promise.all([
    supabase
      .from("exam_questions")
      .select("id, position, question_text, options, correct_option, points")
      .eq("exam_id", examId)
      .order("position"),
    supabase
      .from("exam_attempts")
      .select("id, started_at, submitted_at, score, max_score, students(full_name)")
      .eq("exam_id", examId)
      .order("submitted_at", { ascending: false, nullsFirst: false }),
  ]);

  const attempts = (attemptRows ?? []).map((a) => ({
    ...a,
    studentName: (a.students as unknown as { full_name: string } | null)?.full_name ?? "—",
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/exams" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← Exams
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">{exam.title}</h1>
        <p className="text-sm text-zinc-500">
          {className} {exam.subject ? `· ${exam.subject}` : ""} · {exam.duration_minutes} min
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <StatusButtons examId={exam.id} status={exam.status} />
        {exam.status === "draft" && (questions ?? []).length === 0 && (
          <p className="mt-2 text-xs text-amber-600">Add at least one question before publishing.</p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Questions ({(questions ?? []).length})
        </h2>
        {(questions ?? []).length > 0 && (
          <div className="mb-4 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
            {(questions ?? []).map((q, i) => {
              const options = q.options as unknown as string[];
              return (
                <div key={q.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {i + 1}. {q.question_text}
                    </p>
                    <DeleteQuestionButton questionId={q.id} examId={exam.id} />
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {options.map((opt, idx) => (
                      <li
                        key={idx}
                        className={idx === q.correct_option ? "font-medium text-emerald-700" : "text-zinc-500"}
                      >
                        {idx === q.correct_option ? "✓ " : "· "}
                        {opt}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-zinc-400">{q.points} point{Number(q.points) === 1 ? "" : "s"}</p>
                </div>
              );
            })}
          </div>
        )}
        <QuestionForm examId={exam.id} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Results ({attempts.length})
        </h2>
        {attempts.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
            No students have taken this exam yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium text-zinc-900">{a.studentName}</td>
                    <td className="px-4 py-2 text-zinc-500">
                      {a.submitted_at ? `Submitted ${a.submitted_at.slice(0, 10)}` : "In progress"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-zinc-900">
                      {a.score !== null ? `${a.score}/${a.max_score}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
