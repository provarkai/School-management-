"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { extractJsonFromImage } from "@/lib/ai/vision";
import { matchRosterName } from "@/lib/nameMatch";
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

export interface ScanAttendanceResult {
  marks?: Record<string, AttendanceStatus>;
  matchedCount?: number;
  unmatched?: string[];
  error?: string;
}

interface ScannedAttendanceEntry {
  name: string;
  status: string;
}

/**
 * Reads a photo of a paper attendance register/sign-in sheet and prefills
 * the grid — the teacher still reviews and hits Submit themselves, nothing
 * here writes to the `attendance` table. Names are only ever resolved
 * against this class's real roster (matchRosterName), so a misread or
 * hallucinated name can't attach a mark to the wrong (or a nonexistent)
 * student.
 */
export async function scanAttendanceFromImage(
  imageDataUrl: string,
  classId: string
): Promise<ScanAttendanceResult> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("school_id", profile.school_id ?? "")
    .eq("class_id", classId)
    .eq("status", "active");

  if (!students || students.length === 0) {
    return { error: "No students found in this class." };
  }

  const roster = students.map((s) => s.full_name).join(", ");
  const system = `You read a photo of a school attendance register or sign-in sheet. The class roster is: ${roster}. For each name you can read, work out whether they were marked present, absent, or late. Match names as best you can even with messy handwriting. Return ONLY JSON in this shape: {"entries":[{"name":"...","status":"present"|"absent"|"late"}]}. If a student's mark is unclear or missing, leave them out rather than guessing.`;

  const result = await extractJsonFromImage<{ entries: ScannedAttendanceEntry[] }>(
    system,
    imageDataUrl
  );
  if (result.error) return { error: result.error };

  const entries = result.data?.entries ?? [];
  if (entries.length === 0) {
    return { error: "Couldn't find any names on that photo — try a clearer shot." };
  }

  const marks: Record<string, AttendanceStatus> = {};
  const unmatched: string[] = [];
  const validStatuses = new Set<string>(["present", "absent", "late"]);

  for (const entry of entries) {
    if (!entry?.name || !validStatuses.has(entry.status)) continue;
    const match = matchRosterName(students, entry.name);
    if (match) marks[match.id] = entry.status as AttendanceStatus;
    else unmatched.push(entry.name);
  }

  if (Object.keys(marks).length === 0) {
    return {
      error: "Couldn't match any names on that photo to this class's roster.",
      unmatched,
    };
  }

  return {
    marks,
    matchedCount: Object.keys(marks).length,
    unmatched: unmatched.length ? unmatched : undefined,
  };
}
