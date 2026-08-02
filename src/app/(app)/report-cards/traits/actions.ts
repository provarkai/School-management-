"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface TraitSaveState {
  error?: string;
  success?: string;
}

/**
 * Rates a whole class against every trait in one submit — same reasoning as
 * the score grid: 30 students x ~11 traits is 330 values nobody is going to
 * enter one form at a time.
 */
export async function saveTraitRatings(
  classId: string,
  _prevState: TraitSaveState,
  formData: FormData
): Promise<TraitSaveState> {
  const { profile, school } = await requireUser();
  const supabase = await createClient();

  const schoolId = profile.school_id ?? "";
  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  if (!session) return { error: "Set the school's current session first." };

  const [{ data: students }, { data: traits }] = await Promise.all([
    supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("status", "active"),
    supabase.from("report_card_traits").select("id").eq("school_id", schoolId),
  ]);

  const studentIds = new Set((students ?? []).map((s) => s.id));
  const traitIds = new Set((traits ?? []).map((t) => t.id));

  if (studentIds.size === 0) return { error: "No active students in this class." };
  if (traitIds.size === 0) return { error: "No traits configured — set them up under Grading." };

  const rows: {
    school_id: string;
    student_id: string;
    trait_id: string;
    session: string;
    term: string;
    rating: number;
    updated_by: string;
    updated_at: string;
  }[] = [];

  const now = new Date().toISOString();

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("rating_")) continue;
    const value = String(raw).trim();
    // Unrated stays unrated rather than defaulting to a middling score —
    // an invented 3/5 would read as a real judgement on the printed card.
    if (value === "") continue;

    const [, studentId, traitId] = key.split("_");
    if (!studentIds.has(studentId) || !traitIds.has(traitId)) continue;

    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: "Ratings must be whole numbers from 1 to 5." };
    }

    rows.push({
      school_id: schoolId,
      student_id: studentId,
      trait_id: traitId,
      session,
      term,
      rating,
      updated_by: profile.id,
      updated_at: now,
    });
  }

  if (rows.length === 0) return { error: "Nothing rated yet." };

  const { error } = await supabase
    .from("student_trait_ratings")
    .upsert(rows, { onConflict: "student_id,trait_id,session,term" });

  if (error) return { error: error.message };

  revalidatePath("/report-cards/traits");
  return { success: `Saved ${rows.length} rating${rows.length === 1 ? "" : "s"}.` };
}
