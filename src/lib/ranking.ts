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

  // Equal averages share a position, and the next student takes the place
  // their combined count reaches ("standard competition ranking": 1, 2, 2,
  // 4). Ranking purely by array index instead would hand two children with
  // identical averages a 1st and a 2nd on their printed report cards,
  // decided by nothing more than the order Postgres returned the rows —
  // which is the sort of thing a parent brings back to the school.
  const ranking = new Map<string, RankingEntry>();
  let lastAverage: number | null = null;
  let lastPosition = 0;

  averages.forEach((entry, index) => {
    const position = lastAverage !== null && entry.average === lastAverage ? lastPosition : index + 1;
    ranking.set(entry.studentId, { position, outOf: averages.length });
    lastAverage = entry.average;
    lastPosition = position;
  });

  return ranking;
}
