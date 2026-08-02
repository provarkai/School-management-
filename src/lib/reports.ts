import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows, fetchAllRowsByIds } from "@/lib/fetchAll";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Names for the student ids a report row set references. Chunked because
 * a report can easily span every student in the school, and the id list
 * travels in the URL. */
async function fetchStudentNames(
  supabase: SupabaseClient,
  studentIds: string[]
): Promise<{ id: string; full_name: string }[]> {
  return fetchAllRowsByIds<{ id: string; full_name: string }>(
    studentIds,
    (chunk, from, to) =>
      supabase.from("students").select("id, full_name").in("id", chunk).order("id").range(from, to)
  );
}

export type ReportSourceKey = "students" | "fees" | "attendance" | "results";

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSource {
  key: ReportSourceKey;
  label: string;
  columns: ReportColumn[];
}

export const REPORT_SOURCES: ReportSource[] = [
  {
    key: "students",
    label: "Students",
    columns: [
      { key: "full_name", label: "Full Name" },
      { key: "class", label: "Class" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "parent_name", label: "Parent Name" },
      { key: "parent_phone", label: "Parent Phone" },
      { key: "admission_date", label: "Admission Date" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "fees",
    label: "Fees",
    columns: [
      { key: "student_name", label: "Student" },
      { key: "fee_type_name", label: "Fee Type" },
      { key: "session", label: "Session" },
      { key: "term", label: "Term" },
      { key: "amount_expected", label: "Expected" },
      { key: "amount_paid", label: "Paid" },
      { key: "balance", label: "Balance" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "attendance",
    label: "Attendance",
    columns: [
      { key: "student_name", label: "Student" },
      { key: "class", label: "Class" },
      { key: "date", label: "Date" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "results",
    label: "Results",
    columns: [
      { key: "student_name", label: "Student" },
      { key: "subject", label: "Subject" },
      { key: "session", label: "Session" },
      { key: "term", label: "Term" },
      { key: "ca_score", label: "CA Score" },
      { key: "exam_score", label: "Exam Score" },
      { key: "total", label: "Total" },
      { key: "grade", label: "Grade" },
    ],
  },
];

export function getReportSource(key: string): ReportSource | undefined {
  return REPORT_SOURCES.find((s) => s.key === key);
}

export interface ReportFilters {
  classId?: string;
  status?: string;
  session?: string;
  term?: string;
  dateFrom?: string;
  dateTo?: string;
  subject?: string;
}

export async function fetchReportRows(
  supabase: SupabaseClient,
  schoolId: string,
  source: ReportSourceKey,
  filters: ReportFilters
): Promise<Record<string, unknown>[]> {
  if (source === "students") {
    const { data: classes } = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
    const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

    const data = await fetchAllRows<{
      full_name: string;
      class_id: string | null;
      date_of_birth: string | null;
      parent_name: string | null;
      parent_phone: string | null;
      admission_date: string;
      status: string;
    }>((from, to) => {
      let query = supabase
        .from("students")
        .select("full_name, class_id, date_of_birth, parent_name, parent_phone, admission_date, status")
        .eq("school_id", schoolId)
        .order("full_name")
        .order("id");
      if (filters.classId) query = query.eq("class_id", filters.classId);
      if (filters.status) query = query.eq("status", filters.status);
      return query.range(from, to);
    });

    return data.map((s) => ({
      full_name: s.full_name,
      class: s.class_id ? classNameById.get(s.class_id) ?? "" : "",
      date_of_birth: s.date_of_birth ?? "",
      parent_name: s.parent_name ?? "",
      parent_phone: s.parent_phone ?? "",
      admission_date: s.admission_date,
      status: s.status,
    }));
  }

  if (source === "fees") {
    const data = await fetchAllRows<{
      student_id: string;
      fee_type_name: string;
      session: string;
      term: string;
      amount_expected: number;
      amount_paid: number;
      balance: number;
      status: string;
    }>((from, to) => {
      let query = supabase
        .from("fee_summary")
        .select("student_id, fee_type_name, session, term, amount_expected, amount_paid, balance, status")
        .eq("school_id", schoolId);
      if (filters.session) query = query.eq("session", filters.session);
      if (filters.term) query = query.eq("term", filters.term);
      if (filters.status) query = query.eq("status", filters.status);
      return query.order("fee_record_id").range(from, to);
    });

    const studentIds = [...new Set(data.map((r) => r.student_id))];
    const students = await fetchStudentNames(supabase, studentIds);
    const nameById = new Map(students.map((s) => [s.id, s.full_name]));

    return data.map((r) => ({
      student_name: nameById.get(r.student_id) ?? "",
      fee_type_name: r.fee_type_name,
      session: r.session,
      term: r.term,
      amount_expected: Number(r.amount_expected),
      amount_paid: Number(r.amount_paid),
      balance: Number(r.balance),
      status: r.status,
    }));
  }

  if (source === "attendance") {
    const data = await fetchAllRows<{
      student_id: string;
      class_id: string;
      date: string;
      status: string;
    }>((from, to) => {
      let query = supabase
        .from("attendance")
        .select("student_id, class_id, date, status")
        .eq("school_id", schoolId)
        .order("date", { ascending: false })
        .order("id");
      if (filters.classId) query = query.eq("class_id", filters.classId);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("date", filters.dateTo);
      return query.range(from, to);
    });

    const studentIds = [...new Set(data.map((r) => r.student_id))];
    const classIds = [...new Set(data.map((r) => r.class_id))];
    const [students, { data: classes }] = await Promise.all([
      fetchStudentNames(supabase, studentIds),
      classIds.length
        ? supabase.from("classes").select("id, name").in("id", classIds)
        : Promise.resolve({ data: [] }),
    ]);
    const nameById = new Map(students.map((s) => [s.id, s.full_name]));
    const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

    return data.map((r) => ({
      student_name: nameById.get(r.student_id) ?? "",
      class: classNameById.get(r.class_id) ?? "",
      date: r.date,
      status: r.status,
    }));
  }

  // results
  const data = await fetchAllRows<{
    student_id: string;
    subject: string;
    session: string;
    term: string;
    ca_score: number | null;
    exam_score: number | null;
    total: number;
    grade: string | null;
  }>((from, to) => {
    let query = supabase
      .from("results")
      .select("student_id, subject, session, term, ca_score, exam_score, total, grade")
      .eq("school_id", schoolId)
      .order("subject")
      .order("id");
    if (filters.session) query = query.eq("session", filters.session);
    if (filters.term) query = query.eq("term", filters.term);
    if (filters.subject) query = query.eq("subject", filters.subject);
    return query.range(from, to);
  });

  const studentIds = [...new Set(data.map((r) => r.student_id))];
  const students = await fetchStudentNames(supabase, studentIds);
  const nameById = new Map(students.map((s) => [s.id, s.full_name]));

  return data.map((r) => ({
    student_name: nameById.get(r.student_id) ?? "",
    subject: r.subject,
    session: r.session,
    term: r.term,
    ca_score: Number(r.ca_score),
    exam_score: Number(r.exam_score),
    total: Number(r.total),
    grade: r.grade ?? "",
  }));
}
