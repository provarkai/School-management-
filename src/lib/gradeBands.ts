import type { createClient } from "@/lib/supabase/server";
import { GRADE_POINTS } from "@/lib/grading";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * A school's letter -> GPA points map, for computeGPA().
 *
 * Falls back to the fixed 5-point scale when a school has no bands, which
 * mirrors what set_result_grade() does in Postgres — the two have to agree,
 * or a grade awarded by the trigger could score no points here.
 */
export async function getGradePoints(
  supabase: SupabaseClient,
  schoolId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("grade_bands")
    .select("letter, points")
    .eq("school_id", schoolId);

  if (!data || data.length === 0) return GRADE_POINTS;
  return Object.fromEntries(data.map((b) => [b.letter, Number(b.points)]));
}
