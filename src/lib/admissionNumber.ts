import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Claims the next admission number for a school — {prefix}-{sequence},
 * e.g. "OSS-0001". Assigned once at creation and never regenerated, so it
 * stays fixed for the student's entire time at the school.
 *
 * Atomic at the database level (see migration 0056's next_admission_number
 * function): the row lock an UPDATE takes implicitly means two students
 * created at the same moment can never be handed the same number.
 */
export async function nextAdmissionNumber(
  supabase: SupabaseClient,
  schoolId: string
): Promise<string> {
  const { data, error } = await supabase.rpc("next_admission_number", {
    target_school_id: schoolId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Could not generate an admission number.");
  }

  return data as string;
}
