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
];

export function getExportDataset(key: string): ExportDataset | undefined {
  return EXPORT_DATASETS.find((d) => d.key === key);
}
