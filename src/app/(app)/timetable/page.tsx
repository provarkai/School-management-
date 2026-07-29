import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_LABELS } from "@/lib/types";
import { PeriodSlotsManager } from "./PeriodSlotsManager";
import { ClassPicker } from "./ClassPicker";
import { TimetableCell } from "./TimetableCell";
import { ShareLinkButton } from "../students/[id]/ShareLinkButton";

const WEEKDAYS = [1, 2, 3, 4, 5];

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, school } = await requireUser();
  const { class: classParam } = await searchParams;
  const supabase = await createClient();

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  const [{ data: classes }, { data: periodSlots }, { data: subjects }, { data: teachers }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id, name, share_token")
        .eq("session", school?.current_session ?? "")
        .eq("term", school?.current_term ?? "1")
        .order("name"),
      supabase
        .from("period_slots")
        .select("*")
        .eq("school_id", profile.school_id ?? "")
        .order("position"),
      supabase
        .from("subjects")
        .select("id, name")
        .eq("school_id", profile.school_id ?? "")
        .order("name"),
      supabase.from("app_users").select("id, name").eq("role", "teacher").order("name"),
    ]);

  const selectedClassId = classParam ?? classes?.[0]?.id ?? "";
  const selectedClass = (classes ?? []).find((c) => c.id === selectedClassId) ?? null;

  const { data: entries } = selectedClassId
    ? await supabase
        .from("timetable_entries")
        .select("period_slot_id, day_of_week, subject_id, teacher_id")
        .eq("class_id", selectedClassId)
    : { data: [] };

  const entryByCell = new Map(
    (entries ?? []).map((e) => [`${e.period_slot_id}:${e.day_of_week}`, e])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Timetable</h1>
        <p className="text-sm text-zinc-500">
          {school?.current_session} · {school ? `Term ${school.current_term}` : ""}
        </p>
      </div>

      {profile.role === "proprietor" && <PeriodSlotsManager periodSlots={periodSlots ?? []} />}

      {(classes ?? []).length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No classes for this term yet — add one on the Classes page first.
        </p>
      ) : (periodSlots ?? []).length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          Set up daily periods above before building a class timetable.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ClassPicker classes={classes ?? []} current={selectedClassId} />
            {selectedClass && (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/timetable/print/${selectedClass.id}`}
                  target="_blank"
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  Print
                </Link>
                <ShareLinkButton
                  url={`${protocol}://${host}/t/${selectedClass.share_token}`}
                  label="Copy shareable timetable link"
                />
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="w-32 px-3 py-2 text-left font-medium text-zinc-500">Period</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} className="px-3 py-2 text-left font-medium text-zinc-500">
                      {WEEKDAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
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
                      const entry = entryByCell.get(`${p.id}:${d}`);
                      const subjectName = (subjects ?? []).find((s) => s.id === entry?.subject_id)
                        ?.name;
                      const teacherName = (teachers ?? []).find((t) => t.id === entry?.teacher_id)
                        ?.name;

                      return (
                        <td key={d} className="min-w-[9rem] px-3 py-2 align-top">
                          {profile.role === "proprietor" ? (
                            <TimetableCell
                              classId={selectedClassId}
                              periodSlotId={p.id}
                              dayOfWeek={d}
                              subjectId={entry?.subject_id ?? null}
                              teacherId={entry?.teacher_id ?? null}
                              subjects={subjects ?? []}
                              teachers={teachers ?? []}
                            />
                          ) : (
                            <div>
                              <p className="text-zinc-900">{subjectName ?? "—"}</p>
                              <p className="text-xs text-zinc-400">{teacherName ?? ""}</p>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
