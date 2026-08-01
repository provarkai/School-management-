"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";

export interface SubmitStaffAttendanceState {
  error?: string;
  success?: string;
}

export async function submitStaffAttendance(
  date: string,
  entries: { staffId: string; status: AttendanceStatus }[]
): Promise<SubmitStaffAttendanceState> {
  const { profile } = await requireProprietor();

  if (entries.length === 0) {
    return { error: "Mark at least one staff member before submitting." };
  }

  const supabase = await createClient();
  const rows = entries.map((e) => ({
    school_id: profile.school_id,
    staff_id: e.staffId,
    date,
    status: e.status,
    marked_by: profile.id,
  }));

  const { error } = await supabase
    .from("staff_attendance")
    .upsert(rows, { onConflict: "staff_id,date" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/staff-attendance");
  return { success: `Attendance saved for ${entries.length} staff member(s).` };
}
