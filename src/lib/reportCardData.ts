import type { createClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ReportComponent {
  id: string;
  name: string;
  max_score: number;
}

export interface ReportSubjectRow {
  subject: string;
  total: number;
  grade: string | null;
  /** component id -> score, for the per-component columns */
  componentScores: Record<string, number>;
  classAverage: number | null;
  classHighest: number | null;
  classLowest: number | null;
}

export interface ReportAttendance {
  present: number;
  absent: number;
  late: number;
  total: number;
  /** False when no term-start event exists, so the figures cover every
   * record on file rather than this term alone. */
  bounded: boolean;
}

export interface ReportTrait {
  name: string;
  rating: number | null;
}

export interface ReportCardExtras {
  components: ReportComponent[];
  subjects: ReportSubjectRow[];
  attendance: ReportAttendance;
  affective: ReportTrait[];
  psychomotor: ReportTrait[];
  gradeKey: { letter: string; min_score: number }[];
  nextTermBegins: string | null;
}

/**
 * Everything the report card shows beyond the student's own name — the
 * component breakdown, class comparisons, attendance, behavioural ratings,
 * grade key and next-term date.
 *
 * Shared by the single and bulk PDF routes and the on-screen report card so
 * the printed card and the screen can't disagree.
 */
export async function getReportCardExtras(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string,
  classId: string | null,
  session: string,
  term: Term
): Promise<ReportCardExtras> {
  const [
    { data: componentRows },
    { data: gradeBands },
    { data: traitRows },
    { data: ratingRows },
    { data: termEvents },
  ] = await Promise.all([
    supabase
      .from("assessment_components")
      .select("id, name, max_score")
      .eq("school_id", schoolId)
      .order("position"),
    supabase
      .from("grade_bands")
      .select("letter, min_score")
      .eq("school_id", schoolId)
      .order("min_score", { ascending: false }),
    supabase
      .from("report_card_traits")
      .select("id, name, domain")
      .eq("school_id", schoolId)
      .order("position"),
    supabase
      .from("student_trait_ratings")
      .select("trait_id, rating")
      .eq("student_id", studentId)
      .eq("session", session)
      .eq("term", term),
    // The calendar has no session/term column, so the term window is
    // inferred from term_start events either side of today rather than
    // looked up directly.
    supabase
      .from("academic_calendar_events")
      .select("start_date")
      .eq("school_id", schoolId)
      .eq("event_type", "term_start")
      .order("start_date"),
  ]);

  const components = (componentRows ?? []) as ReportComponent[];

  const today = new Date().toISOString().slice(0, 10);
  const starts = (termEvents ?? []).map((e) => e.start_date as string);
  const termStart = [...starts].reverse().find((d) => d <= today) ?? null;
  const nextTermBegins = starts.find((d) => d > today) ?? null;

  // --- this student's results, with their component breakdown ---
  const { data: results } = await supabase
    .from("results")
    .select("id, subject, total, grade")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .order("subject");

  const resultIds = (results ?? []).map((r) => r.id);
  const { data: componentScores } =
    resultIds.length > 0
      ? await supabase
          .from("result_component_scores")
          .select("result_id, component_id, score")
          .in("result_id", resultIds)
      : { data: [] };

  const scoresByResult = new Map<string, Record<string, number>>();
  for (const s of componentScores ?? []) {
    const bucket = scoresByResult.get(s.result_id) ?? {};
    bucket[s.component_id] = Number(s.score);
    scoresByResult.set(s.result_id, bucket);
  }

  // --- class comparison per subject ---
  const classTotalsBySubject = new Map<string, number[]>();
  if (classId) {
    const { data: classmates } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", classId)
      .eq("status", "active");

    const classmateIds = (classmates ?? []).map((s) => s.id);
    if (classmateIds.length > 0) {
      const { data: classResults } = await supabase
        .from("results")
        .select("subject, total")
        .eq("session", session)
        .eq("term", term)
        .in("student_id", classmateIds);

      for (const r of classResults ?? []) {
        const list = classTotalsBySubject.get(r.subject) ?? [];
        list.push(Number(r.total));
        classTotalsBySubject.set(r.subject, list);
      }
    }
  }

  const subjects: ReportSubjectRow[] = (results ?? []).map((r) => {
    const totals = classTotalsBySubject.get(r.subject) ?? [];
    return {
      subject: r.subject,
      total: Number(r.total),
      grade: r.grade,
      componentScores: scoresByResult.get(r.id) ?? {},
      classAverage: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
      classHighest: totals.length ? Math.max(...totals) : null,
      classLowest: totals.length ? Math.min(...totals) : null,
    };
  });

  // --- attendance, bounded to the term where the calendar allows ---
  let attendanceQuery = supabase.from("attendance").select("status").eq("student_id", studentId);
  if (termStart) attendanceQuery = attendanceQuery.gte("date", termStart);
  const { data: attendanceRows } = await attendanceQuery;

  const rows = attendanceRows ?? [];
  const attendance: ReportAttendance = {
    present: rows.filter((a) => a.status === "present").length,
    absent: rows.filter((a) => a.status === "absent").length,
    late: rows.filter((a) => a.status === "late").length,
    total: rows.length,
    bounded: termStart !== null,
  };

  // --- behavioural ratings ---
  const ratingByTrait = new Map((ratingRows ?? []).map((r) => [r.trait_id, r.rating as number]));
  const traits = (traitRows ?? []) as { id: string; name: string; domain: string }[];
  const toTrait = (t: { id: string; name: string }): ReportTrait => ({
    name: t.name,
    rating: ratingByTrait.get(t.id) ?? null,
  });

  return {
    components,
    subjects,
    attendance,
    affective: traits.filter((t) => t.domain === "affective").map(toTrait),
    psychomotor: traits.filter((t) => t.domain === "psychomotor").map(toTrait),
    gradeKey: (gradeBands ?? []) as { letter: string; min_score: number }[],
    nextTermBegins,
  };
}
