import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

    let query = supabase
      .from("students")
      .select("full_name, class_id, date_of_birth, parent_name, parent_phone, admission_date, status")
      .eq("school_id", schoolId)
      .order("full_name");
    if (filters.classId) query = query.eq("class_id", filters.classId);
    if (filters.status) query = query.eq("status", filters.status);

    const { data } = await query;
    return (data ?? []).map((s) => ({
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
    let query = supabase
      .from("fee_summary")
      .select("student_id, fee_type_name, session, term, amount_expected, amount_paid, balance, status")
      .eq("school_id", schoolId);
    if (filters.session) query = query.eq("session", filters.session);
    if (filters.term) query = query.eq("term", filters.term);
    if (filters.status) query = query.eq("status", filters.status);

    const { data } = await query;
    const studentIds = [...new Set((data ?? []).map((r) => r.student_id))];
    const { data: students } = studentIds.length
      ? await supabase.from("students").select("id, full_name").in("id", studentIds)
      : { data: [] };
    const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

    return (data ?? []).map((r) => ({
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
    let query = supabase
      .from("attendance")
      .select("student_id, class_id, date, status")
      .eq("school_id", schoolId)
      .order("date", { ascending: false });
    if (filters.classId) query = query.eq("class_id", filters.classId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("date", filters.dateTo);

    const { data } = await query;
    const studentIds = [...new Set((data ?? []).map((r) => r.student_id))];
    const classIds = [...new Set((data ?? []).map((r) => r.class_id))];
    const [{ data: students }, { data: classes }] = await Promise.all([
      studentIds.length
        ? supabase.from("students").select("id, full_name").in("id", studentIds)
        : Promise.resolve({ data: [] }),
      classIds.length
        ? supabase.from("classes").select("id, name").in("id", classIds)
        : Promise.resolve({ data: [] }),
    ]);
    const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
    const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

    return (data ?? []).map((r) => ({
      student_name: nameById.get(r.student_id) ?? "",
      class: classNameById.get(r.class_id) ?? "",
      date: r.date,
      status: r.status,
    }));
  }

  // results
  let query = supabase
    .from("results")
    .select("student_id, subject, session, term, ca_score, exam_score, total, grade")
    .eq("school_id", schoolId)
    .order("subject");
  if (filters.session) query = query.eq("session", filters.session);
  if (filters.term) query = query.eq("term", filters.term);
  if (filters.subject) query = query.eq("subject", filters.subject);

  const { data } = await query;
  const studentIds = [...new Set((data ?? []).map((r) => r.student_id))];
  const { data: students } = studentIds.length
    ? await supabase.from("students").select("id, full_name").in("id", studentIds)
    : { data: [] };
  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  return (data ?? []).map((r) => ({
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
