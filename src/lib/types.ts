export type Role = "proprietor" | "teacher" | "staff";
export type NoticeAudience = "all" | "teachers" | "staff";
export type Term = "1" | "2" | "3";
export type StudentStatus = "active" | "withdrawn" | "graduated";
export type AttendanceStatus = "present" | "absent" | "late";
export type FeeStatus = "paid" | "partial" | "owing";
export type BehaviorCategory = "merit" | "demerit";
export type BehaviorSeverity = "minor" | "major" | "severe";
export type CalendarEventType = "term_start" | "term_end" | "holiday" | "exam" | "pta_meeting" | "event";
export type CustomFieldType = "text" | "number" | "date" | "select";
export type Gender = "male" | "female";

export type SchoolStatus = "active" | "suspended";

export interface School {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  current_session: string;
  current_term: Term;
  status: SchoolStatus;
  quick_links: string[];
  withhold_results_when_owing: boolean;
  promotion_min_average: number;
  promotion_subject_pass_mark: number;
  promotion_max_failed_subjects: number;
  created_at: string;
}

export interface AppUser {
  id: string;
  school_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  subject: string | null;
  job_title: string | null;
  campus_id: string | null;
  photo_url: string | null;
  gender: Gender | null;
  is_school_admin: boolean;
  dashboard_widgets: string[] | null;
  created_at: string;
}

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  term_start: "Term start",
  term_end: "Term end",
  holiday: "Holiday",
  exam: "Exam",
  pta_meeting: "PTA meeting",
  event: "Event",
};

export interface PeriodSlot {
  id: string;
  school_id: string;
  position: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  applies_on_friday: boolean;
  created_at: string;
}

export const TERM_LABELS: Record<Term, string> = {
  "1": "1st Term",
  "2": "2nd Term",
  "3": "3rd Term",
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};
