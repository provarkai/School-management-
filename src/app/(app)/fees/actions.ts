"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/current-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { feeReminderTemplate } from "@/lib/sms";
import { sendAndLogMessage } from "@/lib/messageLog";
import { createPaymentIntent } from "@/lib/payments";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";
import { logActivity } from "@/lib/activityLog";
import { siteOrigin } from "@/lib/siteUrl";
import { assertInSchool } from "@/lib/assertInSchool";

export interface FeeActionState {
  error?: string;
  success?: string;
}

async function getOrCreateFeeRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  studentId: string,
  feeTypeId: string,
  session: string,
  term: string
) {
  const { data: existing } = await supabase
    .from("fee_records")
    .select("id")
    .eq("student_id", studentId)
    .eq("fee_type_id", feeTypeId)
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  if (existing) return existing.id as string;

  // studentId/feeTypeId come from the form, not a lookup the app itself
  // did — confirm both are actually in this school before creating a
  // fee_record that points at them.
  await assertInSchool(supabase, "students", studentId, schoolId);
  await assertInSchool(supabase, "fee_types", feeTypeId, schoolId);

  const { data: created, error } = await supabase
    .from("fee_records")
    .insert({ school_id: schoolId, student_id: studentId, fee_type_id: feeTypeId, session, term, amount_expected: 0 })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function setFeeAmount(
  studentId: string,
  feeTypeId: string,
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const amount = Number(formData.get("amount_expected"));

  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Enter a valid amount." };
  }

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const feeRecordId = await getOrCreateFeeRecord(
    supabase,
    profile.school_id!,
    studentId,
    feeTypeId,
    session,
    term
  );

  const { error } = await supabase
    .from("fee_records")
    .update({ amount_expected: amount })
    .eq("id", feeRecordId);

  if (error) return { error: error.message };

  revalidatePath("/fees");
  revalidatePath(`/fees/student/${studentId}`);
  return { success: "Fee amount updated." };
}

export interface FeeTypeFormState {
  error?: string;
}

export async function createFeeType(
  _prevState: FeeTypeFormState,
  formData: FormData
): Promise<FeeTypeFormState> {
  const { profile } = await requirePermission("fees");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Fee type name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fee_types").insert({
    school_id: profile.school_id,
    name,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `"${name}" is already in the fee type list.` };
    }
    return { error: error.message };
  }

  revalidatePath("/fees");
  return {};
}

export async function deleteFeeType(feeTypeId: string) {
  await requirePermission("fees");
  const supabase = await createClient();
  const { error } = await supabase.from("fee_types").delete().eq("id", feeTypeId);
  if (error) throw new Error(error.message);
  revalidatePath("/fees");
}

export async function setStudentDiscount(
  studentId: string,
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const discountAmount = Number(formData.get("discount_amount"));
  const discountReason = String(formData.get("discount_reason") ?? "").trim() || null;

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return { error: "Enter a valid discount amount." };
  }

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: fees } = await supabase
    .from("fee_summary")
    .select("fee_record_id, sticker_amount_expected")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .order("fee_type_name");

  if (!fees || fees.length === 0) {
    return { error: "No fee types have been set for this student this term yet." };
  }

  const totalCharges = fees.reduce((sum, f) => sum + Number(f.sticker_amount_expected), 0);
  if (discountAmount > totalCharges) {
    return { error: `Discount can't exceed total charges of ${naira(totalCharges)}.` };
  }

  // Applied against the total, not one fee type at a time: covers each fee
  // type's sticker amount in display order (same order recordPayment
  // allocates a payment in), capped so no line ever gets discounted below
  // zero — the same "one number in, allocated across the line items" shape
  // the combined payment already uses, so the itemized invoice stays
  // consistent between the two.
  let remaining = discountAmount;
  const allocations = new Map<string, number>();
  for (const f of fees) {
    const cap = Number(f.sticker_amount_expected);
    const take = Math.min(remaining, cap);
    allocations.set(f.fee_record_id, take);
    remaining -= take;
  }

  const results = await Promise.all(
    fees.map((f) => {
      const allocated = allocations.get(f.fee_record_id) ?? 0;
      return supabase
        .from("fee_records")
        .update({
          discount_amount: allocated,
          discount_reason: allocated > 0 ? discountReason : null,
        })
        .eq("id", f.fee_record_id);
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  const { data: student } = await supabase
    .from("students")
    .select("full_name")
    .eq("id", studentId)
    .single();

  await logActivity(
    supabase,
    profile,
    discountAmount > 0 ? "discount_applied" : "discount_removed",
    discountAmount > 0
      ? `Applied a ${naira(discountAmount)} discount on the total fees for ${student?.full_name ?? "a student"}.`
      : `Removed the discount for ${student?.full_name ?? "a student"}.`
  );

  revalidatePath("/fees");
  revalidatePath(`/fees/student/${studentId}`);
  return { success: discountAmount > 0 ? "Discount applied." : "Discount removed." };
}

export interface BulkSetClassFeeState {
  error?: string;
  success?: string;
}

export async function setClassFeeAmount(
  _prevState: BulkSetClassFeeState,
  formData: FormData
): Promise<BulkSetClassFeeState> {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const feeTypeId = String(formData.get("fee_type_id") ?? "");
  const amount = Number(formData.get("amount_expected"));

  if (!classId || !feeTypeId) {
    return { error: "Choose a class and a fee type." };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Enter a valid amount." };
  }

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (studentsError) return { error: studentsError.message };
  if (!students || students.length === 0) {
    return { error: "No active students in that class." };
  }

  const { error } = await supabase.from("fee_records").upsert(
    students.map((s) => ({
      school_id: profile.school_id,
      student_id: s.id,
      fee_type_id: feeTypeId,
      session,
      term,
      amount_expected: amount,
    })),
    { onConflict: "student_id,session,term,fee_type_id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/fees");
  return { success: `Set for ${students.length} student(s) in that class.` };
}

// A parent hands over one lump sum, not a separate cheque per fee type — so
// a single payment amount here is spread across whatever the student still
// owes, in the same fee-type order shown on the page, rather than making
// staff split it themselves and record it type by type. Each affected fee
// type still gets its own fee_payments row under the hood (that FK is
// per-record), it's just that staff never has to think about the split.
export async function recordPayment(
  studentId: string,
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const amount = Number(formData.get("amount"));
  const paymentDate = String(formData.get("payment_date") ?? "") || undefined;
  const method = String(formData.get("method") ?? "cash");
  const reference = String(formData.get("reference_number") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid payment amount." };
  }

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: fees } = await supabase
    .from("fee_summary")
    .select("fee_record_id, balance")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .order("fee_type_name");

  if (!fees || fees.length === 0) {
    return { error: "No fee types have been set for this student this term yet." };
  }

  // Cover outstanding balances first, in display order. Anything left over
  // (an overpayment/advance) lands on the last fee type rather than being
  // dropped, so the amount recorded always matches what was actually paid.
  let remaining = amount;
  const allocations = new Map<string, number>();
  for (const f of fees) {
    if (remaining <= 0) break;
    const balance = Number(f.balance);
    if (balance <= 0) continue;
    const take = Math.min(remaining, balance);
    allocations.set(f.fee_record_id, (allocations.get(f.fee_record_id) ?? 0) + take);
    remaining -= take;
  }
  if (remaining > 0) {
    const last = fees[fees.length - 1];
    allocations.set(last.fee_record_id, (allocations.get(last.fee_record_id) ?? 0) + remaining);
  }

  const { error } = await supabase.from("fee_payments").insert(
    Array.from(allocations.entries()).map(([fee_record_id, allocatedAmount]) => ({
      school_id: profile.school_id,
      fee_record_id,
      amount: allocatedAmount,
      ...(paymentDate ? { payment_date: paymentDate } : {}),
      method,
      reference_number: reference,
      recorded_by: profile.id,
    }))
  );

  if (error) return { error: error.message };

  const { data: student } = await supabase
    .from("students")
    .select("full_name")
    .eq("id", studentId)
    .single();

  await logActivity(
    supabase,
    profile,
    "fee_payment_recorded",
    `Recorded a ${naira(amount)} ${method} payment for ${student?.full_name ?? "a student"}.`
  );

  revalidatePath("/fees");
  revalidatePath(`/fees/student/${studentId}`);
  return { success: "Payment recorded." };
}

export async function sendFeeReminder(
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const studentId = String(formData.get("student_id"));

  const { data: student } = await supabase
    .from("students")
    .select("full_name, parent_name, parent_phone, parent_email")
    .eq("id", studentId)
    .single();

  if (!student?.parent_phone) {
    return { error: "This student has no parent phone number on file." };
  }

  const session = school?.current_session ?? "";
  const term = (school?.current_term ?? "1") as Term;

  const { data: fees } = await supabase
    .from("fee_summary")
    .select("fee_record_id, fee_type_name, balance")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term);

  const owing = (fees ?? []).filter((f) => Number(f.balance) > 0);
  if (owing.length === 0) {
    return { error: "This student has no outstanding balance." };
  }

  // The breakdown by fee type stays in the message text so the parent can
  // see what makes up the total — but it's one bill, so there's one "Pay"
  // link for the combined balance, not a separate checkout per fee type.
  const total = owing.reduce((sum, f) => sum + Number(f.balance), 0);
  const lines = owing.map((f) => `${f.fee_type_name}: ${naira(Number(f.balance))}`);

  const payLink = await buildPaymentLink({
    schoolId: profile.school_id!,
    feeRecordId: owing[0].fee_record_id,
    studentId,
    amountNaira: total,
    email: student.parent_email,
    initiatedBy: profile.id,
    coversAllFeeTypes: true,
  });

  const message =
    feeReminderTemplate({
      parentName: student.parent_name || "Parent",
      studentName: student.full_name,
      balance: naira(total),
      termLabel: TERM_LABELS[term],
      schoolName: school?.name ?? "the school",
    }) +
    ` Breakdown — ${lines.join("; ")}.` +
    (payLink ? ` Pay: ${payLink}` : "");

  const result = await sendAndLogMessage(
    supabase,
    {
      schoolId: profile.school_id ?? "",
      purpose: "fee_reminder",
      recipientName: student.parent_name,
      studentId,
      sentBy: profile.id,
    },
    student.parent_phone,
    message
  );

  if (!result.ok) {
    return { error: result.error ?? "Failed to send reminder." };
  }

  return {
    success: result.mocked
      ? "Reminder logged (mock mode — set SMSLIVE247_API_KEY to send for real)."
      : "Reminder sent.",
  };
}

async function buildPaymentLink(params: {
  schoolId: string;
  feeRecordId: string;
  studentId: string;
  amountNaira: number;
  email: string | null;
  initiatedBy: string;
  coversAllFeeTypes?: boolean;
}): Promise<string | null> {
  const origin = await siteOrigin();

  const admin = createAdminClient();
  const result = await createPaymentIntent(admin, {
    schoolId: params.schoolId,
    feeRecordId: params.feeRecordId,
    studentId: params.studentId,
    amountNaira: params.amountNaira,
    email: params.email ?? `parent+${params.studentId}@noemail.example`,
    callbackUrl: `${origin}/pay/callback?student=${params.studentId}`,
    initiatedBy: params.initiatedBy,
    coversAllFeeTypes: params.coversAllFeeTypes,
  });

  return result.ok ? result.authorizationUrl ?? null : null;
}

export interface PaymentLinkState {
  error?: string;
  url?: string;
  mocked?: boolean;
}

export async function generatePaymentLink(
  studentId: string,
  feeTypeId: string,
  _prevState: PaymentLinkState,
  _formData: FormData
): Promise<PaymentLinkState> {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("parent_email")
    .eq("id", studentId)
    .single();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: fee } = await supabase
    .from("fee_summary")
    .select("fee_record_id, balance")
    .eq("student_id", studentId)
    .eq("fee_type_id", feeTypeId)
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  const balance = Number(fee?.balance ?? 0);
  if (!fee || balance <= 0) {
    return { error: "No outstanding balance for this fee type." };
  }

  const origin = await siteOrigin();

  const admin = createAdminClient();
  const result = await createPaymentIntent(admin, {
    schoolId: profile.school_id!,
    feeRecordId: fee.fee_record_id,
    studentId,
    amountNaira: balance,
    email: student?.parent_email ?? `parent+${studentId}@noemail.example`,
    callbackUrl: `${origin}/pay/callback?student=${studentId}`,
    initiatedBy: profile.id,
  });

  if (!result.ok || !result.authorizationUrl) {
    return { error: result.error ?? "Could not create a payment link." };
  }

  return { url: result.authorizationUrl, mocked: result.mocked };
}
