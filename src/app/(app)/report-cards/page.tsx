import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, isManager, school } = await requireUser();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const schoolId = profile.school_id ?? "";
  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  let classesQuery = supabase.from("classes").select("id, name").order("name");
  if (profile.role === "teacher" && !isManager) {
    classesQuery = classesQuery.eq("teacher_id", profile.id);
  }
  const { data: classes } = await classesQuery;
  const selectedClassId = classParam || classes?.[0]?.id;

  const [{ data: students }, { data: subjects }] = await Promise.all([
    selectedClassId
      ? supabase
          .from("students")
          .select("id, full_name")
          .eq("class_id", selectedClassId)
          .eq("status", "active")
          .order("full_name")
      : Promise.resolve({ data: [] }),
    supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
  ]);

  const studentIds = (students ?? []).map((s) => s.id);

  // Registrations and results are fetched once for the whole class and
  // grouped in JS — doing it per subject would be a query per subject on
  // every page load.
  const [{ data: registrations }, { data: results }] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("student_subjects")
          .select("student_id, subject_id")
          .eq("session", session)
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase
          .from("results")
          .select("student_id, subject")
          .eq("session", session)
          .eq("term", term)
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const registeredBySubject = new Map<string, Set<string>>();
  for (const r of registrations ?? []) {
    const set = registeredBySubject.get(r.subject_id) ?? new Set<string>();
    set.add(r.student_id);
    registeredBySubject.set(r.subject_id, set);
  }

  // Counted by subject name rather than subject_id: scores entered before
  // the FK existed have a null subject_id, and they're still entered.
  const enteredBySubject = new Map<string, Set<string>>();
  for (const r of results ?? []) {
    const set = enteredBySubject.get(r.subject) ?? new Set<string>();
    set.add(r.student_id);
    enteredBySubject.set(r.subject, set);
  }

  const entryStatus = (subjects ?? []).map((subject) => {
    const registered = registeredBySubject.get(subject.id);
    const eligible = registered ? registered.size : studentIds.length;
    const entered = enteredBySubject.get(subject.name)?.size ?? 0;
    return { ...subject, eligible, entered };
  });

  const outstanding = entryStatus.filter((s) => s.eligible > 0 && s.entered < s.eligible);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Report cards</h1>
          <p className="text-sm text-zinc-500">
            {session} · Term {term}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedClassId && (
            <Link
              href={`/report-cards/grid?class=${selectedClassId}`}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Enter scores
            </Link>
          )}
          {selectedClassId && (
            <a
              href={`/report-cards/pdf/class/${selectedClassId}`}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Generate PDFs for class
            </a>
          )}
        </div>
      </div>

      {(classes ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(classes ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/report-cards?class=${c.id}`}
              className={`rounded-full px-3 py-1 ${
                selectedClassId === c.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {entryStatus.length > 0 && studentIds.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Score entry — {outstanding.length === 0 ? "all subjects complete" : `${outstanding.length} outstanding`}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Subject</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Entered</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {entryStatus.map((s) => {
                  const complete = s.eligible > 0 && s.entered >= s.eligible;
                  const percent = s.eligible > 0 ? Math.round((s.entered / s.eligible) * 100) : 0;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2 font-medium text-zinc-900">{s.name}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={`h-full rounded-full ${
                                complete ? "bg-emerald-600" : "bg-amber-500"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className={complete ? "text-emerald-700" : "text-zinc-500"}>
                            {s.entered}/{s.eligible}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/report-cards/grid?class=${selectedClassId}&subject=${s.id}`}
                          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
                        >
                          {complete ? "Review" : "Enter"} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Students
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Student</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(students ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900">{s.full_name}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-4">
                      <Link
                        href={`/report-cards/${s.id}`}
                        className="font-medium text-zinc-600 hover:text-zinc-900"
                      >
                        Details
                      </Link>
                      <a
                        href={`/report-cards/pdf/${s.id}`}
                        className="font-medium text-zinc-600 hover:text-zinc-900"
                      >
                        Download PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {(students ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-zinc-400">
                    No students in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
