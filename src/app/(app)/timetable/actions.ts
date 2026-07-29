"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface PeriodSlotFormState {
  error?: string;
}

// Break lands right at midday; the school day runs to 2pm Mon-Thu but
// closes at 1pm on Fridays, so periods after 1pm are flagged as not
// applying on Fridays.
const DEFAULT_PERIODS: {
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  applies_on_friday: boolean;
}[] = [
  { label: "Period 1", start_time: "08:00", end_time: "08:40", is_break: false, applies_on_friday: true },
  { label: "Period 2", start_time: "08:40", end_time: "09:20", is_break: false, applies_on_friday: true },
  { label: "Period 3", start_time: "09:20", end_time: "10:00", is_break: false, applies_on_friday: true },
  { label: "Period 4", start_time: "10:00", end_time: "10:40", is_break: false, applies_on_friday: true },
  { label: "Period 5", start_time: "10:40", end_time: "11:20", is_break: false, applies_on_friday: true },
  { label: "Period 6", start_time: "11:20", end_time: "12:00", is_break: false, applies_on_friday: true },
  { label: "Break", start_time: "12:00", end_time: "12:20", is_break: true, applies_on_friday: true },
  { label: "Period 7", start_time: "12:20", end_time: "13:00", is_break: false, applies_on_friday: true },
  { label: "Period 8", start_time: "13:00", end_time: "13:30", is_break: false, applies_on_friday: false },
  { label: "Period 9", start_time: "13:30", end_time: "14:00", is_break: false, applies_on_friday: false },
];

export async function createPeriodSlot(
  _prevState: PeriodSlotFormState,
  formData: FormData
): Promise<PeriodSlotFormState> {
  const { profile } = await requireProprietor();

  const label = String(formData.get("label") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const isBreak = formData.get("is_break") === "on";
  const skipFriday = formData.get("skip_friday") === "on";

  if (!label || !startTime || !endTime) {
    return { error: "Label, start time and end time are all required." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("period_slots")
    .select("position")
    .eq("school_id", profile.school_id ?? "")
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("period_slots").insert({
    school_id: profile.school_id,
    position: nextPosition,
    label,
    start_time: startTime,
    end_time: endTime,
    is_break: isBreak,
    applies_on_friday: !skipFriday,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/timetable");
  return {};
}

export async function generateDefaultPeriods() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { count } = await supabase
    .from("period_slots")
    .select("id", { count: "exact", head: true })
    .eq("school_id", profile.school_id ?? "");

  if (count && count > 0) return;

  const { error } = await supabase.from("period_slots").insert(
    DEFAULT_PERIODS.map((p, i) => ({
      school_id: profile.school_id,
      position: i + 1,
      ...p,
    }))
  );

  if (error) throw new Error(error.message);
  revalidatePath("/timetable");
}

export async function deletePeriodSlot(periodSlotId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("period_slots").delete().eq("id", periodSlotId);
  if (error) throw new Error(error.message);
  revalidatePath("/timetable");
}

export interface TimetableCellFormState {
  error?: string;
  ok?: boolean;
}

export async function setTimetableEntry(
  classId: string,
  periodSlotId: string,
  dayOfWeek: number,
  _prevState: TimetableCellFormState,
  formData: FormData
): Promise<TimetableCellFormState> {
  const { profile } = await requireProprietor();

  const subjectId = String(formData.get("subject_id") ?? "") || null;
  const teacherId = String(formData.get("teacher_id") ?? "") || null;

  const supabase = await createClient();

  if (teacherId) {
    const { data: conflicts } = await supabase
      .from("timetable_entries")
      .select("class_id, classes(name)")
      .eq("period_slot_id", periodSlotId)
      .eq("day_of_week", dayOfWeek)
      .eq("teacher_id", teacherId)
      .neq("class_id", classId);

    if (conflicts && conflicts.length > 0) {
      const other = conflicts[0].classes as unknown as { name: string } | null;
      return {
        error: `This teacher is already scheduled for ${other?.name ?? "another class"} at this time.`,
      };
    }
  }

  const { error } = await supabase.from("timetable_entries").upsert(
    {
      school_id: profile.school_id,
      class_id: classId,
      period_slot_id: periodSlotId,
      day_of_week: dayOfWeek,
      subject_id: subjectId,
      teacher_id: teacherId,
    },
    { onConflict: "class_id,period_slot_id,day_of_week" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/timetable");
  return { ok: true };
}
