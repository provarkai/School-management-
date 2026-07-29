export type Role = "proprietor" | "teacher" | "staff";
export type NoticeAudience = "all" | "teachers" | "staff";
export type Term = "1" | "2" | "3";
export type StudentStatus = "active" | "withdrawn";
export type AttendanceStatus = "present" | "absent" | "late";
export type PaymentMethod = "cash" | "transfer" | "paystack";
export type FeeStatus = "paid" | "partial" | "owing";
export type PaymentIntentStatus = "pending" | "success" | "failed";
export type BehaviorCategory = "merit" | "demerit";
export type BehaviorSeverity = "minor" | "major" | "severe";

export interface School {
  id: string;
  name: string;
  address: string | null;
  logo_url: string | null;
  current_session: string;
  current_term: Term;
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
  created_at: string;
}

export interface StaffNotice {
  id: string;
  school_id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  created_by: string | null;
  created_at: string;
}

export interface FeeType {
  id: string;
  school_id: string;
  name: string;
  created_at: string;
}

export interface Campus {
  id: string;
  school_id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  teacher_id: string | null;
  campus_id: string | null;
  session: string;
  term: Term;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  full_name: string;
  class_id: string | null;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  admission_date: string;
  status: StudentStatus;
  created_at: string;
}

export interface Parent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface FeeRecord {
  id: string;
  school_id: string;
  student_id: string;
  session: string;
  term: Term;
  fee_type_id: string;
  amount_expected: number;
  created_at: string;
  updated_at: string;
}

export interface FeeSummary {
  fee_record_id: string;
  school_id: string;
  student_id: string;
  session: string;
  term: Term;
  fee_type_id: string;
  fee_type_name: string;
  amount_expected: number;
  amount_paid: number;
  balance: number;
  status: FeeStatus;
  last_payment_date: string | null;
  sticker_amount_expected: number;
  discount_amount: number;
  discount_reason: string | null;
}

export interface FeePayment {
  id: string;
  school_id: string;
  fee_record_id: string;
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  reference_number: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string | null;
  created_at: string;
}

export interface ResultRecord {
  id: string;
  school_id: string;
  student_id: string;
  subject: string;
  session: string;
  term: Term;
  ca_score: number;
  exam_score: number;
  total: number;
  grade: string | null;
  created_at: string;
  updated_at: string;
}

export interface BehaviorIncident {
  id: string;
  school_id: string;
  student_id: string;
  incident_date: string;
  category: BehaviorCategory;
  severity: BehaviorSeverity;
  description: string;
  action_taken: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface PaymentIntent {
  id: string;
  school_id: string;
  fee_record_id: string;
  student_id: string;
  reference: string;
  amount: number;
  status: PaymentIntentStatus;
  authorization_url: string | null;
  fee_payment_id: string | null;
  initiated_by: string | null;
  created_at: string;
  verified_at: string | null;
}

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

export interface TimetableEntry {
  id: string;
  school_id: string;
  class_id: string;
  period_slot_id: string;
  day_of_week: number;
  subject_id: string | null;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
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
