import type { createAdminClient } from "@/lib/supabase/server";
import { fetchAllRows, fetchAllRowsByIds } from "@/lib/fetchAll";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * A school's entire record, as data rather than as a report.
 *
 * This is deliberately not the same thing as the Settings export. That one
 * is shaped for a human — joined names, friendly column headers, a subset
 * of tables — and could not be used to rebuild a school. This dumps every
 * row of every table belonging to the school, keeping the real column
 * names and ids, so `scripts/restore-school.ts` can put it back.
 *
 * Storage files (student documents, learning resources, logos, photos) are
 * NOT included — they live in Supabase Storage, not Postgres. Their rows
 * are captured, so a restore rebuilds the records with their file paths
 * intact; the files themselves need Supabase's own storage backups.
 */

/** Tables carrying school_id — the bulk of a school's data. */
const SCHOOL_SCOPED_TABLES = [
  "academic_calendar_events",
  "admission_prospects",
  "app_users",
  "assessment_components",
  "assignments",
  "attendance",
  "bank_transfer_alerts",
  "behavior_incidents",
  "broadcasts",
  "campuses",
  "class_topic_progress",
  "classes",
  "deduction_types",
  "exams",
  "expense_categories",
  "expenses",
  "fee_payments",
  "fee_records",
  "fee_types",
  "grade_bands",
  "learning_resources",
  "payment_intents",
  "payroll_entries",
  "payroll_entry_deductions",
  "payroll_runs",
  "period_slots",
  "report_card_traits",
  "report_remarks",
  "result_component_scores",
  "results",
  "staff_attendance",
  "staff_notices",
  "staff_salaries",
  "student_documents",
  "student_field_definitions",
  "student_field_values",
  "student_promotions",
  "student_subjects",
  "student_trait_ratings",
  "students",
  "subjects",
  "syllabus_topics",
  "timetable_entries",
] as const;

export interface SchoolSnapshot {
  /** Bumped when the shape changes, so a restore can refuse a file it
   * doesn't understand rather than half-applying it. */
  format: 1;
  takenAt: string;
  schoolId: string;
  schoolName: string;
  tables: Record<string, Record<string, unknown>[]>;
  /** Row counts, so a truncated or empty snapshot is obvious on sight
   * without parsing the whole file. */
  counts: Record<string, number>;
}

export async function buildSchoolSnapshot(
  admin: AdminClient,
  schoolId: string
): Promise<SchoolSnapshot> {
  const tables: Record<string, Record<string, unknown>[]> = {};

  const { data: school } = await admin
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .single();

  if (!school) {
    throw new Error(`No school with id ${schoolId}`);
  }

  tables.schools = [school];

  for (const table of SCHOOL_SCOPED_TABLES) {
    tables[table] = await fetchAllRows<Record<string, unknown>>((from, to) =>
      admin.from(table).select("*").eq("school_id", schoolId).order("id").range(from, to)
    );
  }

  // Child tables keyed to a parent rather than to the school.
  const examIds = (tables.exams ?? []).map((e) => String(e.id));
  const studentIds = (tables.students ?? []).map((s) => String(s.id));

  tables.exam_questions = await fetchAllRowsByIds<Record<string, unknown>>(
    examIds,
    (chunk, from, to) =>
      admin.from("exam_questions").select("*").in("exam_id", chunk).order("id").range(from, to)
  );

  tables.exam_attempts = await fetchAllRowsByIds<Record<string, unknown>>(
    examIds,
    (chunk, from, to) =>
      admin.from("exam_attempts").select("*").in("exam_id", chunk).order("id").range(from, to)
  );

  const attemptIds = tables.exam_attempts.map((a) => String(a.id));
  tables.exam_answers = await fetchAllRowsByIds<Record<string, unknown>>(
    attemptIds,
    (chunk, from, to) =>
      admin.from("exam_answers").select("*").in("attempt_id", chunk).order("id").range(from, to)
  );

  // Parent accounts are shared across schools in principle, so only the
  // links to this school's students are taken, plus the parents on the
  // other end of them.
  tables.parent_students = await fetchAllRowsByIds<Record<string, unknown>>(
    studentIds,
    (chunk, from, to) =>
      admin
        .from("parent_students")
        .select("*")
        .in("student_id", chunk)
        .order("parent_id")
        .range(from, to)
  );

  const parentIds = Array.from(
    new Set(tables.parent_students.map((p) => String(p.parent_id)))
  );
  tables.parents = await fetchAllRowsByIds<Record<string, unknown>>(
    parentIds,
    (chunk, from, to) =>
      admin.from("parents").select("*").in("id", chunk).order("id").range(from, to)
  );

  const counts = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.length])
  );

  return {
    format: 1,
    takenAt: new Date().toISOString(),
    schoolId,
    schoolName: String(school.name),
    tables,
    counts,
  };
}

/**
 * Insert order for a restore. Parents come before children so foreign keys
 * are satisfiable, and it is the exact reverse of a safe delete order.
 */
export const RESTORE_ORDER = [
  "schools",
  "app_users",
  "campuses",
  "classes",
  "students",
  "parents",
  "parent_students",
  "subjects",
  "student_subjects",
  "assessment_components",
  "grade_bands",
  "report_card_traits",
  "results",
  "result_component_scores",
  "student_trait_ratings",
  "report_remarks",
  "attendance",
  "behavior_incidents",
  "student_field_definitions",
  "student_field_values",
  "student_documents",
  "student_promotions",
  "fee_types",
  "fee_records",
  "fee_payments",
  "payment_intents",
  "bank_transfer_alerts",
  "expense_categories",
  "expenses",
  "deduction_types",
  "staff_salaries",
  "payroll_runs",
  "payroll_entries",
  "payroll_entry_deductions",
  "period_slots",
  "timetable_entries",
  "assignments",
  "learning_resources",
  "syllabus_topics",
  "class_topic_progress",
  "exams",
  "exam_questions",
  "exam_attempts",
  "exam_answers",
  "academic_calendar_events",
  "admission_prospects",
  "staff_attendance",
  "staff_notices",
  "broadcasts",
] as const;
