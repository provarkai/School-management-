import type { createClient } from "@/lib/supabase/server";
import type { Role, Term } from "@/lib/types";
import { fetchAllRowsByIds } from "@/lib/fetchAll";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface StaffPerformanceRow {
  staffId: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  classesTaught: string[];
  totalStudents: number;
  studentsWithResults: number;
  averageScore: number | null;
  attendanceDaysMarked: number;
  assignmentsIssued: number;
  meritsRecorded: number;
  demeritsRecorded: number;
}

export interface StaffPerformance {
  rows: StaffPerformanceRow[];
  /** Distinct dates any class in the school marked attendance this term —
   * the denominator a teacher's own attendanceDaysMarked can be judged
   * against. */
  schoolWideDays: number;
}

/**
 * Every metric here is derived from data already tagged to the current
 * session/term (classes are per-term rows, so filtering by class_id
 * automatically scopes attendance/assignments to the term). There is no
 * staff-performance table — attribution comes from the existing
 * marked_by/created_by/recorded_by/teacher_id columns.
 */
export async function getStaffPerformance(
  supabase: SupabaseClient,
  schoolId: string,
  session: string,
  term: Term
): Promise<StaffPerformance> {
  const { data: staff } = await supabase
    .from("app_users")
    .select("id, name, role, job_title")
    .eq("school_id", schoolId)
    .in("role", ["teacher", "staff"])
    .order("name");

  const staffList = staff ?? [];
  if (staffList.length === 0) return { rows: [], schoolWideDays: 0 };

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, teacher_id")
    .eq("school_id", schoolId)
    .eq("session", session)
    .eq("term", term);

  const classList = classes ?? [];
  const classIds = classList.map((c) => c.id);

  const { data: students } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .in("class_id", classIds.length > 0 ? classIds : [""]);

  const studentList = students ?? [];
  const studentIds = studentList.map((s) => s.id);

  // Every one of these grows with the size of the school — a term's
  // results and a term's attendance both run well past what a single
  // request returns — so they're read in full rather than trusting one
  // page of each.
  const [results, attendance, assignments, incidents] = await Promise.all([
    fetchAllRowsByIds<{ student_id: string; total: number }>(studentIds, (chunk, from, to) =>
      supabase
        .from("results")
        .select("student_id, total")
        .eq("school_id", schoolId)
        .eq("session", session)
        .eq("term", term)
        .in("student_id", chunk)
        .order("id")
        .range(from, to)
    ),
    fetchAllRowsByIds<{ class_id: string; date: string }>(classIds, (chunk, from, to) =>
      supabase
        .from("attendance")
        .select("class_id, date")
        .eq("school_id", schoolId)
        .in("class_id", chunk)
        .order("id")
        .range(from, to)
    ),
    fetchAllRowsByIds<{ created_by: string | null; class_id: string }>(
      classIds,
      (chunk, from, to) =>
        supabase
          .from("assignments")
          .select("created_by, class_id")
          .eq("school_id", schoolId)
          .in("class_id", chunk)
          .order("id")
          .range(from, to)
    ),
    fetchAllRowsByIds<{ recorded_by: string | null; category: string; student_id: string }>(
      studentIds,
      (chunk, from, to) =>
        supabase
          .from("behavior_incidents")
          .select("recorded_by, category, student_id")
          .eq("school_id", schoolId)
          .in("student_id", chunk)
          .order("id")
          .range(from, to)
    ),
  ]);

  // Distinct dates any class marked attendance this term — the denominator
  // every teacher's own marking rate can be judged against.
  const schoolWideDays = new Set(attendance.map((a) => a.date)).size;

  const daysByClass = new Map<string, Set<string>>();
  for (const row of attendance) {
    const set = daysByClass.get(row.class_id) ?? new Set<string>();
    set.add(row.date);
    daysByClass.set(row.class_id, set);
  }

  const resultsByStudent = new Map<string, number[]>();
  for (const row of results) {
    const list = resultsByStudent.get(row.student_id) ?? [];
    list.push(Number(row.total));
    resultsByStudent.set(row.student_id, list);
  }

  const assignmentCountByStaff = new Map<string, number>();
  for (const row of assignments) {
    if (!row.created_by) continue;
    assignmentCountByStaff.set(row.created_by, (assignmentCountByStaff.get(row.created_by) ?? 0) + 1);
  }

  const meritsByStaff = new Map<string, number>();
  const demeritsByStaff = new Map<string, number>();
  for (const row of incidents) {
    if (!row.recorded_by) continue;
    const map = row.category === "merit" ? meritsByStaff : demeritsByStaff;
    map.set(row.recorded_by, (map.get(row.recorded_by) ?? 0) + 1);
  }

  const rows = staffList.map((person) => {
    const ownClasses = classList.filter((c) => c.teacher_id === person.id);
    const ownClassIds = new Set(ownClasses.map((c) => c.id));
    const ownStudents = studentList.filter((s) => s.class_id && ownClassIds.has(s.class_id));

    let studentsWithResults = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    for (const s of ownStudents) {
      const scores = resultsByStudent.get(s.id);
      if (scores && scores.length > 0) {
        studentsWithResults++;
        for (const total of scores) {
          scoreSum += total;
          scoreCount++;
        }
      }
    }

    const attendanceDaysMarked = new Set(
      ownClasses.flatMap((c) => Array.from(daysByClass.get(c.id) ?? []))
    ).size;

    return {
      staffId: person.id,
      name: person.name,
      role: person.role as Role,
      jobTitle: person.job_title,
      classesTaught: ownClasses.map((c) => c.name),
      totalStudents: ownStudents.length,
      studentsWithResults,
      averageScore: scoreCount > 0 ? scoreSum / scoreCount : null,
      attendanceDaysMarked,
      assignmentsIssued: assignmentCountByStaff.get(person.id) ?? 0,
      meritsRecorded: meritsByStaff.get(person.id) ?? 0,
      demeritsRecorded: demeritsByStaff.get(person.id) ?? 0,
    };
  });

  return { rows, schoolWideDays };
}
