"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { feeReminderTemplate, sendReminderMessage } from "@/lib/termii";
import { createPaymentIntent } from "@/lib/payments";
import { naira } from "@/lib/format";
import { TERM_LABELS, type Term } from "@/lib/types";

export interface FeeActionState {
  error?: string;
  success?: string;
}

async function getOrCreateFeeRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolId: string,
  studentId: string,
  session: string,
  term: string
) {
  const { data: existing } = await supabase
    .from("fee_records")
    .select("id")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("fee_records")
    .insert({ school_id: schoolId, student_id: studentId, session, term, amount_expected: 0 })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function setFeeAmount(
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id"));
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

export async function recordPayment(
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id"));
  const amount = Number(formData.get("amount"));
  const paymentDate = String(formData.get("payment_date") ?? "") || undefined;
  const method = String(formData.get("method") ?? "cash");
  const reference = String(formData.get("reference_number") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid payment amount." };
  }

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const feeRecordId = await getOrCreateFeeRecord(
    supabase,
    profile.school_id!,
    studentId,
    session,
    term
  );

  const { error } = await supabase.from("fee_payments").insert({
    school_id: profile.school_id,
    fee_record_id: feeRecordId,
    amount,
    ...(paymentDate ? { payment_date: paymentDate } : {}),
    method,
    reference_number: reference,
    recorded_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/fees");
  revalidatePath(`/fees/student/${studentId}`);
  return { success: "Payment recorded." };
}

export async function sendFeeReminder(
  _prevState: FeeActionState,
  formData: FormData
): Promise<FeeActionState> {
  const { profile, school } = await requireProprietor();
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

  const { data: fee } = await supabase
    .from("fee_summary")
    .select("fee_record_id, balance")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  const balance = Number(fee?.balance ?? 0);
  if (!fee || balance <= 0) {
    return { error: "This student has no outstanding balance." };
  }

  const payLink = await buildPaymentLink({
    schoolId: profile.school_id!,
    feeRecordId: fee.fee_record_id,
    studentId,
    amountNaira: balance,
    email: student.parent_email,
    initiatedBy: profile.id,
  });

  const message =
    feeReminderTemplate({
      parentName: student.parent_name || "Parent",
      studentName: student.full_name,
      balance: naira(balance),
      termLabel: TERM_LABELS[term],
      schoolName: school?.name ?? "the school",
    }) + (payLink ? ` Pay online: ${payLink}` : "");

  const result = await sendReminderMessage(student.parent_phone, message);

  if (!result.ok) {
    return { error: result.error ?? "Failed to send reminder." };
  }

  return {
    success: result.mocked
      ? "Reminder logged (mock mode — set TERMII_API_KEY to send for real)."
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
}): Promise<string | null> {
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return null;
  const protocol = host.startsWith("localhost") ? "http" : "https";

  const admin = createAdminClient();
  const result = await createPaymentIntent(admin, {
    schoolId: params.schoolId,
    feeRecordId: params.feeRecordId,
    studentId: params.studentId,
    amountNaira: params.amountNaira,
    email: params.email ?? `parent+${params.studentId}@noemail.example`,
    callbackUrl: `${protocol}://${host}/pay/callback?student=${params.studentId}`,
    initiatedBy: params.initiatedBy,
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
  _prevState: PaymentLinkState,
  _formData: FormData
): Promise<PaymentLinkState> {
  const { profile, school } = await requireProprietor();
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
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  const balance = Number(fee?.balance ?? 0);
  if (!fee || balance <= 0) {
    return { error: "This student has no outstanding balance." };
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";

  const admin = createAdminClient();
  const result = await createPaymentIntent(admin, {
    schoolId: profile.school_id!,
    feeRecordId: fee.fee_record_id,
    studentId,
    amountNaira: balance,
    email: student?.parent_email ?? `parent+${studentId}@noemail.example`,
    callbackUrl: `${protocol}://${host}/pay/callback?student=${studentId}`,
    initiatedBy: profile.id,
  });

  if (!result.ok || !result.authorizationUrl) {
    return { error: result.error ?? "Could not create a payment link." };
  }

  return { url: result.authorizationUrl, mocked: result.mocked };
}
