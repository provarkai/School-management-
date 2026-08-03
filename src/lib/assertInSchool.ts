import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Confirms a foreign id taken from a form (not one the app itself just
 * looked up) actually belongs to the caller's own school before it's used
 * to write another row. RLS validates the school_id value a write
 * carries, not that the *other* ids it references — a student, a staff
 * member — point at rows in that same school. Without this, a crafted
 * request can create a fee record in school A against a student in
 * school B: it leaks nothing (school A can't read school B's rows back)
 * and needs a known UUID, but the pattern recurs, so one shared check.
 */
export async function assertInSchool(
  supabase: SupabaseClient,
  table: string,
  id: string,
  schoolId: string
): Promise<void> {
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!data) {
    throw new Error("Not found.");
  }
}
