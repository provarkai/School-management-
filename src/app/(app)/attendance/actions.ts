"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";

export interface SubmitAttendanceState {
  error?: string;
  success?: string;
}

export async function submitAttendance(
  classId: string,
  date: string,
  entries: { studentId: string; status: AttendanceStatus }[]
): Promise<SubmitAttendanceState> {
  const { profile } = await requireUser();

  if (entries.length === 0) {
    return { error: "Mark at least one student before submitting." };
  }

  const supabase = await createClient();
  const rows = entries.map((e) => ({
    school_id: profile.school_id,
    student_id: e.studentId,
    class_id: classId,
    date,
    status: e.status,
    marked_by: profile.id,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,date" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/attendance");
  revalidatePath("/attendance/history");
  return { success: `Attendance saved for ${entries.length} student(s).` };
}
