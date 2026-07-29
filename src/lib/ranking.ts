import type { createClient } from "@/lib/supabase/server";

export interface RankingEntry {
  position: number;
  outOf: number;
}

/**
 * Ranks every student in a class by their average score (CA + exam) across
 * all subjects recorded for the given session/term. Students with no scores
 * yet are excluded from ranking (not just placed last) since an average of
 * zero subjects isn't a meaningful position.
 */
export async function computeClassRanking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  session: string,
  term: string
): Promise<Map<string, RankingEntry>> {
  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active");

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) return new Map();

  const { data: results } = await supabase
    .from("results")
    .select("student_id, total")
    .in("student_id", studentIds)
    .eq("session", session)
    .eq("term", term);

  const totalsByStudent = new Map<string, number[]>();
  for (const r of results ?? []) {
    const list = totalsByStudent.get(r.student_id) ?? [];
    list.push(Number(r.total));
    totalsByStudent.set(r.student_id, list);
  }

  const averages = Array.from(totalsByStudent.entries()).map(([studentId, totals]) => ({
    studentId,
    average: totals.reduce((sum, t) => sum + t, 0) / totals.length,
  }));

  averages.sort((a, b) => b.average - a.average);

  const ranking = new Map<string, RankingEntry>();
  averages.forEach((entry, index) => {
    ranking.set(entry.studentId, { position: index + 1, outOf: averages.length });
  });

  return ranking;
}
