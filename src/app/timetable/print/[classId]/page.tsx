import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS } from "@/lib/types";
import { PrintButton } from "./PrintButton";

const WEEKDAYS = [1, 2, 3, 4, 5];

export default async function PrintTimetablePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const { profile, school } = await requireUser();
  const supabase = await createClient();

  const { data: klass } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (!klass) notFound();

  const [{ data: periodSlots }, { data: entries }, { data: subjects }, { data: teachers }] =
    await Promise.all([
      supabase
        .from("period_slots")
        .select("*")
        .eq("school_id", profile.school_id ?? "")
        .order("position"),
      supabase
        .from("timetable_entries")
        .select("period_slot_id, day_of_week, subject_id, teacher_id")
        .eq("class_id", klass.id),
      supabase.from("subjects").select("id, name").eq("school_id", profile.school_id ?? ""),
      supabase.from("app_users").select("id, name").eq("school_id", profile.school_id ?? ""),
    ]);

  const entryByCell = new Map(
    (entries ?? []).map((e) => [`${e.period_slot_id}:${e.day_of_week}`, e])
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {school?.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{klass.name} Timetable</h1>
          <p className="text-sm text-zinc-500">
            {school?.current_session} · Term {school?.current_term}
          </p>
        </div>
        <PrintButton />
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-zinc-300 px-3 py-2 text-left font-medium text-zinc-700">
              Period
            </th>
            {WEEKDAYS.map((d) => (
              <th
                key={d}
                className="border border-zinc-300 px-3 py-2 text-left font-medium text-zinc-700"
              >
                {WEEKDAY_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(periodSlots ?? []).map((p) => (
            <tr key={p.id}>
              <td className="border border-zinc-300 px-3 py-2 align-top">
                <p className="font-medium text-zinc-900">{p.label}</p>
                <p className="text-xs text-zinc-400">
                  {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                </p>
              </td>
              {WEEKDAYS.map((d) => {
                if (p.is_break) {
                  return (
                    <td
                      key={d}
                      className="border border-zinc-300 px-3 py-2 text-center text-xs text-zinc-400"
                    >
                      —
                    </td>
                  );
                }
                const entry = entryByCell.get(`${p.id}:${d}`);
                const subjectName = (subjects ?? []).find((s) => s.id === entry?.subject_id)?.name;
                const teacherName = (teachers ?? []).find((t) => t.id === entry?.teacher_id)?.name;
                return (
                  <td key={d} className="border border-zinc-300 px-3 py-2 align-top">
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
  );
}
