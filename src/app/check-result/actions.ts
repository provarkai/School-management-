"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { checkFeeGate } from "@/lib/feeGate";
import { TERM_LABELS, type Term } from "@/lib/types";

export interface ResultRow {
  subject: string;
  total: number;
  grade: string | null;
}

export interface CheckResultState {
  error?: string;
  result?: {
    schoolName: string;
    studentName: string;
    className: string;
    sessionLabel: string;
    withheld: boolean;
    balance: number;
    rows: ResultRow[];
  };
}

/**
 * Verifies a serial + PIN + admission number and, on success, returns the
 * matching result — mirroring the same read-only view the parent portal
 * and shared student link show, including the fee-withholding gate.
 *
 * Runs entirely on the service-role admin client: there is no session here
 * (this is a public, unauthenticated page), so RLS is bypassed by design,
 * the same way /p/[token] already does for the shared student link. The
 * PIN + admission number pair is the access control, not a login.
 */
export async function checkResult(
  _prevState: CheckResultState,
  formData: FormData
): Promise<CheckResultState> {
  const serial = String(formData.get("serial") ?? "").trim().toUpperCase();
  const pin = String(formData.get("pin") ?? "").trim();
  const admissionNumber = String(formData.get("admission_number") ?? "").trim();

  if (!serial || !pin || !admissionNumber) {
    return { error: "Enter the serial, PIN and admission number." };
  }

  const admin = createAdminClient();

  const { data: pinRow } = await admin
    .from("result_checker_pins")
    .select("id, school_id, session, term, pin, used_count")
    .eq("serial", serial)
    .maybeSingle();

  // Same message whether the serial doesn't exist or the PIN is wrong —
  // telling them apart would let someone iterate PINs against a serial
  // they don't own.
  if (!pinRow || pinRow.pin !== pin) {
    return { error: "That serial and PIN don't match. Check the card and try again." };
  }

  const { data: student } = await admin
    .from("students")
    .select("id, full_name, class_id")
    .eq("school_id", pinRow.school_id)
    .eq("admission_number", admissionNumber)
    .maybeSingle();

  if (!student) {
    return { error: "No student with that admission number was found at this school." };
  }

  const { data: school } = await admin
    .from("schools")
    .select("name, withhold_results_when_owing")
    .eq("id", pinRow.school_id)
    .single();

  const { data: klass } = student.class_id
    ? await admin.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  const gate = await checkFeeGate(
    admin,
    pinRow.school_id,
    student.id,
    pinRow.session,
    pinRow.term as Term,
    school?.withhold_results_when_owing ?? false
  );

  let rows: ResultRow[] = [];
  if (!gate.withheld) {
    const { data: results } = await admin
      .from("results")
      .select("subject, total, grade")
      .eq("student_id", student.id)
      .eq("session", pinRow.session)
      .eq("term", pinRow.term)
      .order("subject");
    rows = (results ?? []).map((r) => ({ subject: r.subject, total: Number(r.total), grade: r.grade }));
  }

  // Not a hard lock — a card stays usable after its first check (see the
  // migration for why), this just records that it has been used.
  await admin
    .from("result_checker_pins")
    .update({
      used_count: pinRow.used_count + 1,
      first_used_at: pinRow.used_count === 0 ? new Date().toISOString() : undefined,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", pinRow.id);

  return {
    result: {
      schoolName: school?.name ?? "",
      studentName: student.full_name,
      className: klass?.name ?? "—",
      sessionLabel: `${pinRow.session} · ${TERM_LABELS[pinRow.term as Term]}`,
      withheld: gate.withheld,
      balance: gate.balance,
      rows,
    },
  };
}
