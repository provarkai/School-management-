import type { createClient } from "@/lib/supabase/server";
import { REPORT_SOURCES, fetchReportRows, type ReportColumn } from "@/lib/reports";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ExportDataset {
  key: string;
  label: string;
  columns: ReportColumn[];
  fetch: (supabase: SupabaseClient, schoolId: string) => Promise<Record<string, unknown>[]>;
}

const STAFF_COLUMNS: ReportColumn[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "role", label: "Type" },
  { key: "subject", label: "Subject" },
  { key: "job_title", label: "Job Title" },
];

const BEHAVIOR_COLUMNS: ReportColumn[] = [
  { key: "student_name", label: "Student" },
  { key: "category", label: "Category" },
  { key: "severity", label: "Severity" },
  { key: "description", label: "Description" },
  { key: "incident_date", label: "Date" },
];

const NOTICE_COLUMNS: ReportColumn[] = [
  { key: "title", label: "Title" },
  { key: "body", label: "Body" },
  { key: "audience", label: "Audience" },
  { key: "created_at", label: "Posted" },
];

const EXPENSE_COLUMNS: ReportColumn[] = [
  { key: "expense_date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "vendor", label: "Vendor" },
  { key: "description", label: "Note" },
  { key: "campus", label: "Campus" },
  { key: "amount", label: "Amount" },
  { key: "session", label: "Session" },
  { key: "term", label: "Term" },
];

const STAFF_ATTENDANCE_COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "staff_name", label: "Staff" },
  { key: "status", label: "Status" },
];

const ADMISSIONS_COLUMNS: ReportColumn[] = [
  { key: "full_name", label: "Name" },
  { key: "desired_class", label: "Desired Class" },
  { key: "parent_name", label: "Parent" },
  { key: "parent_phone", label: "Phone" },
  { key: "parent_email", label: "Email" },
  { key: "status", label: "Status" },
  { key: "entrance_test_score", label: "Test Score" },
  { key: "session", label: "Session" },
];

export const EXPORT_DATASETS: ExportDataset[] = [
  {
    key: "students",
    label: "Students",
    columns: REPORT_SOURCES.find((s) => s.key === "students")!.columns,
    fetch: (supabase, schoolId) => fetchReportRows(supabase, schoolId, "students", {}),
  },
  {
    key: "fees",
    label: "Fees",
    columns: REPORT_SOURCES.find((s) => s.key === "fees")!.columns,
    fetch: (supabase, schoolId) => fetchReportRows(supabase, schoolId, "fees", {}),
  },
  {
    key: "attendance",
    label: "Attendance",
    columns: REPORT_SOURCES.find((s) => s.key === "attendance")!.columns,
    fetch: (supabase, schoolId) => fetchReportRows(supabase, schoolId, "attendance", {}),
  },
  {
    key: "results",
    label: "Results",
    columns: REPORT_SOURCES.find((s) => s.key === "results")!.columns,
    fetch: (supabase, schoolId) => fetchReportRows(supabase, schoolId, "results", {}),
  },
  {
    key: "staff",
    label: "Staff",
    columns: STAFF_COLUMNS,
    fetch: async (supabase, schoolId) => {
      const { data } = await supabase
        .from("app_users")
        .select("name, email, phone, role, subject, job_title")
        .eq("school_id", schoolId)
        .neq("role", "proprietor")
        .order("name");
      return (data ?? []).map((s) => ({
        name: s.name,
        email: s.email ?? "",
        phone: s.phone ?? "",
        role: s.role,
        subject: s.subject ?? "",
        job_title: s.job_title ?? "",
      }));
    },
  },
  {
    key: "behavior_incidents",
    label: "Behavior records",
    columns: BEHAVIOR_COLUMNS,
    fetch: async (supabase, schoolId) => {
      const { data } = await supabase
        .from("behavior_incidents")
        .select("category, severity, description, incident_date, students(full_name)")
        .eq("school_id", schoolId)
        .order("incident_date", { ascending: false });
      return (data ?? []).map((i) => ({
        student_name:
          (i.students as unknown as { full_name: string } | null)?.full_name ?? "",
        category: i.category,
        severity: i.severity,
        description: i.description,
        incident_date: i.incident_date,
      }));
    },
  },
  {
    key: "notices",
    label: "Notices",
    columns: NOTICE_COLUMNS,
    fetch: async (supabase, schoolId) => {
      const { data } = await supabase
        .from("staff_notices")
        .select("title, body, audience, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  },
  {
    key: "expenses",
    label: "Expenses",
    columns: EXPENSE_COLUMNS,
    fetch: async (supabase, schoolId) => {
      const { data } = await supabase
        .from("expenses")
        .select(
          "amount, expense_date, vendor, description, session, term, expense_categories(name), campuses(name)"
        )
        .eq("school_id", schoolId)
        .order("expense_date", { ascending: false });
      return (data ?? []).map((e) => ({
        expense_date: e.expense_date,
        category: (e.expense_categories as unknown as { name: string } | null)?.name ?? "",
        vendor: e.vendor ?? "",
        description: e.description ?? "",
        campus: (e.campuses as unknown as { name: string } | null)?.name ?? "",
        amount: Number(e.amount),
        session: e.session,
        term: e.term,
      }));
    },
  },
  {
    key: "staff_attendance",
    label: "Staff attendance",
    columns: STAFF_ATTENDANCE_COLUMNS,
    fetch: async (supabase, schoolId) => {
      const { data } = await supabase
        .from("staff_attendance")
        .select("date, status, app_users(name)")
        .eq("school_id", schoolId)
        .order("date", { ascending: false });
      return (data ?? []).map((row) => ({
        date: row.date,
        staff_name: (row.app_users as unknown as { name: string } | null)?.name ?? "",
        status: row.status,
      }));
    },
  },
  {
    key: "admissions",
    label: "Admissions",
    columns: ADMISSIONS_COLUMNS,
    fetch: async (supabase, schoolId) => {
      const { data } = await supabase
        .from("admission_prospects")
        .select("full_name, desired_class, parent_name, parent_phone, parent_email, status, entrance_test_score, session")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      return (data ?? []).map((p) => ({
        full_name: p.full_name,
        desired_class: p.desired_class ?? "",
        parent_name: p.parent_name ?? "",
        parent_phone: p.parent_phone ?? "",
        parent_email: p.parent_email ?? "",
        status: p.status,
        entrance_test_score: p.entrance_test_score ?? "",
        session: p.session,
      }));
    },
  },
];

export function getExportDataset(key: string): ExportDataset | undefined {
  return EXPORT_DATASETS.find((d) => d.key === key);
}
