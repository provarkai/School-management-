export type Role = "proprietor" | "teacher";
export type Term = "1" | "2" | "3";
export type StudentStatus = "active" | "withdrawn";
export type AttendanceStatus = "present" | "absent" | "late";
export type PaymentMethod = "cash" | "transfer";
export type FeeStatus = "paid" | "partial" | "owing";

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
  created_at: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  teacher_id: string | null;
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
  admission_date: string;
  status: StudentStatus;
  created_at: string;
}

export interface FeeRecord {
  id: string;
  school_id: string;
  student_id: string;
  session: string;
  term: Term;
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
  amount_expected: number;
  amount_paid: number;
  balance: number;
  status: FeeStatus;
  last_payment_date: string | null;
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

export const TERM_LABELS: Record<Term, string> = {
  "1": "1st Term",
  "2": "2nd Term",
  "3": "3rd Term",
};
