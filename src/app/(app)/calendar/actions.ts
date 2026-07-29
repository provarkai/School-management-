"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEventType } from "@/lib/types";

export interface CalendarEventFormState {
  error?: string;
  success?: string;
}

export async function createCalendarEvent(
  _prevState: CalendarEventFormState,
  formData: FormData
): Promise<CalendarEventFormState> {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const eventType = String(formData.get("event_type") ?? "event") as CalendarEventType;
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "") || null;

  if (!title) {
    return { error: "Enter a title." };
  }
  if (!startDate) {
    return { error: "Choose a start date." };
  }
  if (endDate && endDate < startDate) {
    return { error: "End date can't be before the start date." };
  }

  const { error } = await supabase.from("academic_calendar_events").insert({
    school_id: profile.school_id,
    title,
    description,
    event_type: eventType,
    start_date: startDate,
    end_date: endDate,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: "Event added." };
}

export async function deleteCalendarEvent(eventId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase.from("academic_calendar_events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath("/calendar");
}
