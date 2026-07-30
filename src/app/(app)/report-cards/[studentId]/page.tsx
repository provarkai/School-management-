import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { computeClassRanking } from "@/lib/ranking";
import { computeGPA } from "@/lib/grading";
import { proprietorTitle } from "@/lib/format";
import { ScoreForm, DeleteScoreButton } from "./ScoreForm";
import { RemarksForm } from "./RemarksForm";

export default async function ScoreEntryPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { profile, school, isManager } = await requireUser();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, class_id")
    .eq("id", studentId)
    .single();

  if (!student) notFound();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: results }, { data: subjectRows }, { data: remarks }, { data: proprietor }] = await Promise.all([
    supabase
      .from("results")
      .select("id, subject, ca_score, exam_score, total, grade")
      .eq("student_id", studentId)
      .eq("session", session)
      .eq("term", term)
      .order("subject"),
    supabase
      .from("subjects")
      .select("name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("report_remarks")
      .select("teacher_remark, principal_remark")
      .eq("student_id", studentId)
      .eq("session", session)
      .eq("term", term)
      .maybeSingle(),
    supabase
      .from("app_users")
      .select("gender")
      .eq("school_id", profile.school_id ?? "")
      .eq("role", "proprietor")
      .limit(1)
      .maybeSingle(),
  ]);
  const subjects = (subjectRows ?? []).map((s) => s.name);
  const principalLabel = proprietorTitle(proprietor?.gender ?? null);

  const ranking = student.class_id
    ? (await computeClassRanking(supabase, student.class_id, session, term)).get(studentId) ?? null
    : null;
  const gpa = computeGPA(results ?? []);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{student.full_name}</h1>
          <p className="text-sm text-zinc-500">
            {session} · Term {term}
            {ranking && ` · Position ${ranking.position} of ${ranking.outOf}`}
            {gpa !== null && ` · GPA ${gpa.toFixed(2)}/5`}
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
        <ScoreForm studentId={studentId} subjects={subjects} />
      </section>

      <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
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

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Remarks</h2>
        <RemarksForm
          studentId={studentId}
          teacherRemark={remarks?.teacher_remark ?? null}
          principalRemark={remarks?.principal_remark ?? null}
          principalLabel={principalLabel}
          isManager={isManager}
        />
      </section>
    </div>
  );
}
