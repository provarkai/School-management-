import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface RosterStudent {
  id: string;
  full_name: string;
}

/**
 * Who sits a given subject in a given class.
 *
 * Falls back to the whole class when nobody in it has been registered for
 * the subject this session. That fallback is load-bearing: junior classes
 * take every subject and are never registered individually, and a school
 * that hasn't touched subject registration yet would otherwise open the
 * score grid to find it empty.
 */
export async function getSubjectRoster(
  supabase: SupabaseClient,
  schoolId: string,
  classId: string,
  subjectId: string,
  session: string
): Promise<{ students: RosterStudent[]; fromRegistration: boolean }> {
  const { data: classStudents } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  const all = (classStudents ?? []) as RosterStudent[];
  if (all.length === 0) return { students: [], fromRegistration: false };

  const { data: registered } = await supabase
    .from("student_subjects")
    .select("student_id")
    .eq("subject_id", subjectId)
    .eq("session", session)
    .in(
      "student_id",
      all.map((s) => s.id)
    );

  const registeredIds = new Set((registered ?? []).map((r) => r.student_id));
  if (registeredIds.size === 0) {
    return { students: all, fromRegistration: false };
  }

  return {
    students: all.filter((s) => registeredIds.has(s.id)),
    fromRegistration: true,
  };
}
