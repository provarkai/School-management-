import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ScoreForm, DeleteScoreButton } from "./ScoreForm";

export default async function ScoreEntryPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { school } = await requireUser();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, class_id")
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: results } = await supabase
    .from("results")
    .select("id, subject, ca_score, exam_score, total, grade")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .order("subject");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{student.full_name}</h1>
          <p className="text-sm text-zinc-500">
            {session} · Term {term}
          </p>
        </div>
        <a
          href={`/report-cards/pdf/${student.id}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Download report card PDF
        </a>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Add / update a subject score</h2>
        <ScoreForm studentId={studentId} />
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Subject</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">CA</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Exam</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Total</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Grade</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(results ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">{r.subject}</td>
                <td className="px-4 py-2 text-right text-zinc-500">{r.ca_score}</td>
                <td className="px-4 py-2 text-right text-zinc-500">{r.exam_score}</td>
                <td className="px-4 py-2 text-right font-medium text-zinc-900">{r.total}</td>
                <td className="px-4 py-2 text-zinc-500">{r.grade ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteScoreButton resultId={r.id} studentId={studentId} />
                </td>
              </tr>
            ))}
            {(results ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                  No scores entered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
