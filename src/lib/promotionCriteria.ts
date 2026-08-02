import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface PromotionCriteria {
  minAverage: number;
  subjectPassMark: number;
  maxFailedSubjects: number;
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minAverage: 40,
  subjectPassMark: 40,
  maxFailedSubjects: 3,
};

export type PromotionDecision = "promote" | "repeat";

export interface StudentAssessment {
  studentId: string;
  /** Null when the school entered no results for this student this session. */
  average: number | null;
  subjectsCounted: number;
  subjectsFailed: number;
  recommendation: PromotionDecision;
  /** Short human reason for the recommendation, shown beside it. */
  reason: string;
}

/** Student ids per request. Keeps the `in(...)` filter — which travels in
 * the URL — well short of any proxy's URL length limit. */
const ID_CHUNK = 100;
/** PostgREST's default cap. A whole school's session results run well past
 * it (students x subjects x 3 terms), so pages are read until one comes
 * back short rather than trusting a single request to return everything. */
const PAGE_SIZE = 1000;

interface ResultRow {
  student_id: string;
  subject: string;
  total: number;
}

async function fetchSessionResults(
  supabase: SupabaseClient,
  schoolId: string,
  session: string,
  studentIds: string[]
): Promise<ResultRow[]> {
  const rows: ResultRow[] = [];

  for (let i = 0; i < studentIds.length; i += ID_CHUNK) {
    const chunk = studentIds.slice(i, i + ID_CHUNK);
    let offset = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("results")
        .select("student_id, subject, total")
        .eq("school_id", schoolId)
        .eq("session", session)
        .in("student_id", chunk)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error || !data) break;
      rows.push(...(data as ResultRow[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return rows;
}

/**
 * Works out, for every student in `studentIds`, whether the session's
 * results meet the school's promotion criteria.
 *
 * A subject's mark for the session is the average of its term totals, so a
 * student who did badly in one term but recovered isn't failed on the bad
 * term alone. A student with no results at all is recommended for
 * promotion — the school simply hasn't recorded scores, and holding a
 * child back on missing data would be wrong.
 */
export async function assessStudentsForPromotion(
  supabase: SupabaseClient,
  schoolId: string,
  session: string,
  studentIds: string[],
  criteria: PromotionCriteria
): Promise<Map<string, StudentAssessment>> {
  const assessments = new Map<string, StudentAssessment>();
  if (studentIds.length === 0) return assessments;

  const results = await fetchSessionResults(supabase, schoolId, session, studentIds);

  // student -> subject -> the term totals recorded for it
  const bySubject = new Map<string, Map<string, number[]>>();
  for (const r of results) {
    let subjects = bySubject.get(r.student_id);
    if (!subjects) {
      subjects = new Map();
      bySubject.set(r.student_id, subjects);
    }
    const totals = subjects.get(r.subject) ?? [];
    totals.push(Number(r.total));
    subjects.set(r.subject, totals);
  }

  for (const studentId of studentIds) {
    const subjects = bySubject.get(studentId);

    if (!subjects || subjects.size === 0) {
      assessments.set(studentId, {
        studentId,
        average: null,
        subjectsCounted: 0,
        subjectsFailed: 0,
        recommendation: "promote",
        reason: "No results recorded",
      });
      continue;
    }

    const subjectAverages = Array.from(subjects.values()).map(
      (totals) => totals.reduce((sum, t) => sum + t, 0) / totals.length
    );
    const average =
      subjectAverages.reduce((sum, a) => sum + a, 0) / subjectAverages.length;
    const subjectsFailed = subjectAverages.filter((a) => a < criteria.subjectPassMark).length;

    const failsAverage = average < criteria.minAverage;
    const failsSubjects = subjectsFailed > criteria.maxFailedSubjects;

    const reason = failsAverage
      ? `Average ${average.toFixed(1)}% is below ${criteria.minAverage}%`
      : failsSubjects
        ? `Failed ${subjectsFailed} subjects (limit ${criteria.maxFailedSubjects})`
        : "Meets criteria";

    assessments.set(studentId, {
      studentId,
      average,
      subjectsCounted: subjectAverages.length,
      subjectsFailed,
      recommendation: failsAverage || failsSubjects ? "repeat" : "promote",
      reason,
    });
  }

  return assessments;
}
