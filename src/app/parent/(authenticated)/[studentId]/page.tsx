import { notFound } from "next/navigation";
import Link from "next/link";
import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { CALENDAR_EVENT_TYPE_LABELS, TERM_LABELS, type Term } from "@/lib/types";
import { PayNowButton } from "./PayNowButton";
import { checkFeeGate } from "@/lib/feeGate";

export default async function ParentChildPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const { children } = await requireParent();

  const child = children.find((c) => c.id === studentId);
  if (!child) notFound();

  const supabase = await createClient();

  const { data: school } = await supabase
    .from("schools")
    .select("name, phone, current_session, current_term, withhold_results_when_owing")
    .eq("id", child.school_id)
    .single();

  const session = school?.current_session ?? "";
  const term = (school?.current_term ?? "1") as Term;

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: fees },
    { data: attendance },
    { data: results },
    { data: events },
    { data: assignments },
    { data: resourceRows },
    { data: topicRows },
  ] = await Promise.all([
    supabase
      .from("fee_summary")
      .select("fee_type_id, fee_type_name, amount_expected, amount_paid, balance, status")
      .eq("student_id", child.id)
      .eq("session", session)
      .eq("term", term),
    supabase
      .from("attendance")
      .select("status")
      .eq("student_id", child.id)
      .gte("date", new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10)),
    supabase
      .from("results")
      .select("subject, ca_score, exam_score, total, grade")
      .eq("student_id", child.id)
      .eq("session", session)
      .eq("term", term)
      .order("subject"),
    supabase
      .from("academic_calendar_events")
      .select("id, title, event_type, start_date, end_date")
      .eq("school_id", child.school_id)
      .gte("start_date", today)
      .order("start_date")
      .limit(5),
    child.class_id
      ? supabase
          .from("assignments")
          .select("id, subject, title, due_date")
          .eq("class_id", child.class_id)
          .gte("due_date", today)
          .order("due_date")
          .limit(10)
      : Promise.resolve({ data: [] }),
    child.class_id
      ? supabase
          .from("learning_resources")
          .select("id, subject, title, description, file_path, file_name, external_url, created_at")
          .eq("class_id", child.class_id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase
      .from("syllabus_topics")
      .select("id, subject")
      .eq("school_id", child.school_id)
      .eq("session", session)
      .eq("term", term),
  ]);

  let curriculumProgress: { subject: string; completed: number; total: number }[] = [];
  if (child.class_id && (topicRows ?? []).length > 0) {
    const topicIds = (topicRows ?? []).map((t) => t.id);
    const { data: progressRows } = await supabase
      .from("class_topic_progress")
      .select("topic_id, status")
      .eq("class_id", child.class_id)
      .in("topic_id", topicIds);

    const completedTopicIds = new Set(
      (progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.topic_id)
    );

    const bySubject = new Map<string, { completed: number; total: number }>();
    for (const t of topicRows ?? []) {
      const bucket = bySubject.get(t.subject) ?? { completed: 0, total: 0 };
      bucket.total++;
      if (completedTopicIds.has(t.id)) bucket.completed++;
      bySubject.set(t.subject, bucket);
    }
    curriculumProgress = Array.from(bySubject.entries()).map(([subject, v]) => ({ subject, ...v }));
  }

  const resources = await Promise.all(
    (resourceRows ?? []).map(async (r) => {
      if (!r.file_path) return { ...r, viewUrl: r.external_url as string | null };
      const { data: signed } = await supabase.storage
        .from("learning-resources")
        .createSignedUrl(r.file_path, 3600);
      return { ...r, viewUrl: signed?.signedUrl ?? null };
    })
  );

  const gate = await checkFeeGate(
    supabase,
    child.school_id,
    child.id,
    session,
    term,
    school?.withhold_results_when_owing ?? false
  );

  const attendanceRows = attendance ?? [];
  const present = attendanceRows.filter((a) => a.status === "present").length;
  const attendanceRate = attendanceRows.length
    ? Math.round((present / attendanceRows.length) * 100)
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/parent" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← All children
      </Link>

      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {school?.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{child.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {child.className ?? "—"} · {session} · {TERM_LABELS[term]}
        </p>
        {school?.phone && <p className="mt-1 text-xs text-zinc-400">School office: {school.phone}</p>}
      </div>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">School fees</h2>
        {(fees ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No fee record for this term yet.</p>
        ) : (
          (fees ?? []).map((fee) => (
            <div key={fee.fee_type_id} className="border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0">
              <p className="mb-2 text-sm font-medium text-zinc-700">{fee.fee_type_name}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-zinc-400">Expected</p>
                  <p className="font-semibold text-zinc-900">{naira(Number(fee.amount_expected))}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Paid</p>
                  <p className="font-semibold text-zinc-900">{naira(Number(fee.amount_paid))}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Balance</p>
                  <p className={`font-semibold ${Number(fee.balance) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {naira(Number(fee.balance))}
                  </p>
                </div>
              </div>
              {Number(fee.balance) > 0 && (
                <div className="mt-3">
                  <PayNowButton
                    studentId={child.id}
                    feeTypeId={fee.fee_type_id}
                    label={`Pay ${naira(Number(fee.balance))} now`}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Attendance (last 30 days)</h2>
        {attendanceRate === null ? (
          <p className="text-sm text-zinc-400">No attendance recorded yet.</p>
        ) : (
          <p className="text-2xl font-bold text-zinc-900">
            {attendanceRate}%{" "}
            <span className="text-sm font-normal text-zinc-400">
              present ({present}/{attendanceRows.length} days)
            </span>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Results — {TERM_LABELS[term]}</h2>
        {gate.withheld ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Results are held pending payment of the outstanding {naira(gate.balance)}. You can
            clear it above, or contact the school office.
          </p>
        ) : (results ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No scores entered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                <th className="py-1 font-medium">Subject</th>
                <th className="py-1 text-right font-medium">Total</th>
                <th className="py-1 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(results ?? []).map((r) => (
                <tr key={r.subject}>
                  <td className="py-1.5 text-zinc-900">{r.subject}</td>
                  <td className="py-1.5 text-right text-zinc-500">{r.total}/100</td>
                  <td className="py-1.5 text-right font-medium text-zinc-900">{r.grade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(assignments ?? []).length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Upcoming assignments</h2>
          <ul className="space-y-2">
            {(assignments ?? []).map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-zinc-900">
                  {a.title}
                  {a.subject ? ` (${a.subject})` : ""}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">Due {a.due_date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {curriculumProgress.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Curriculum progress</h2>
          <div className="space-y-3">
            {curriculumProgress.map((c) => {
              const percent = Math.round((c.completed / c.total) * 100);
              return (
                <div key={c.subject}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-zinc-900">{c.subject}</span>
                    <span className="text-xs text-zinc-400">
                      {c.completed}/{c.total} topics
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {resources.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Learning resources</h2>
          <ul className="space-y-2">
            {resources.map((r) => (
              <li key={r.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-zinc-900">
                    {r.title}
                    {r.subject ? ` (${r.subject})` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">{r.created_at.slice(0, 10)}</span>
                </div>
                {r.viewUrl && (
                  <a
                    href={r.viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    {r.file_name ? `Download ${r.file_name}` : "Open link"} →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(events ?? []).length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Upcoming school events</h2>
          <ul className="space-y-2">
            {(events ?? []).map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-zinc-900">{event.title}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {CALENDAR_EVENT_TYPE_LABELS[event.event_type as keyof typeof CALENDAR_EVENT_TYPE_LABELS]} ·{" "}
                  {event.start_date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
