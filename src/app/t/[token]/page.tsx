import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

const WEEKDAYS = [1, 2, 3, 4, 5];

export default async function PublicTimetablePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, school_id")
    .eq("share_token", token)
    .maybeSingle();

  if (!klass) notFound();

  const [{ data: school }, { data: periodSlots }, { data: entries }, { data: subjects }, { data: teachers }] =
    await Promise.all([
      supabase.from("schools").select("name, status").eq("id", klass.school_id).single(),
      supabase
        .from("period_slots")
        .select("*")
        .eq("school_id", klass.school_id)
        .order("position"),
      supabase
        .from("timetable_entries")
        .select("period_slot_id, day_of_week, subject_id, teacher_id")
        .eq("class_id", klass.id),
      supabase.from("subjects").select("id, name").eq("school_id", klass.school_id),
      supabase.from("app_users").select("id, name").eq("school_id", klass.school_id),
    ]);

  if (school?.status === "suspended") notFound();

  const entryByCell = new Map(
    (entries ?? []).map((e) => [`${e.period_slot_id}:${e.day_of_week}`, e])
  );

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 bg-zinc-50 px-4 py-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {school?.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{klass.name} Timetable</h1>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="w-28 px-3 py-2 text-left font-medium text-zinc-500">Period</th>
              {WEEKDAYS.map((d) => (
                <th key={d} className="px-3 py-2 text-left font-medium text-zinc-500">
                  {WEEKDAY_LABELS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(periodSlots ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                  Timetable not set up yet.
                </td>
              </tr>
            )}
            {(periodSlots ?? []).map((p) => (
              <tr key={p.id} className={p.is_break ? "bg-zinc-50" : undefined}>
                <td className="px-3 py-2 align-top">
                  <p className="font-medium text-zinc-900">{p.label}</p>
                  <p className="text-xs text-zinc-400">
                    {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                  </p>
                </td>
                {WEEKDAYS.map((d) => {
                  if (p.is_break) {
                    return (
                      <td key={d} className="px-3 py-2 text-center text-xs text-zinc-400">
                        —
                      </td>
                    );
                  }
                  if (d === 5 && !p.applies_on_friday) {
                    return (
                      <td key={d} className="px-3 py-2 text-center text-xs text-zinc-400">
                        School closed
                      </td>
                    );
                  }
                  const entry = entryByCell.get(`${p.id}:${d}`);
                  const subjectName = (subjects ?? []).find((s) => s.id === entry?.subject_id)?.name;
                  const teacherName = (teachers ?? []).find((t) => t.id === entry?.teacher_id)?.name;
                  return (
                    <td key={d} className="px-3 py-2 align-top">
                      <p className="text-zinc-900">{subjectName ?? "—"}</p>
                      <p className="text-xs text-zinc-400">{teacherName ?? ""}</p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-zinc-400">
        Shared by {school?.name}. Contact the school office with any questions.
      </p>
    </div>
  );
}
