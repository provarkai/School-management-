"use server";

import { revalidatePath } from "next/cache";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";

export interface TransferFormState {
  error?: string;
}

export async function logTransferAlert(
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const { profile } = await requireProprietor();

  const amount = Number(formData.get("amount"));
  const narration = String(formData.get("narration") ?? "").trim();
  const transferDate = String(formData.get("transfer_date") ?? "") || undefined;

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid transfer amount." };
  }
  if (!narration) {
    return { error: "Paste the transfer narration/description." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bank_transfer_alerts").insert({
    school_id: profile.school_id,
    amount,
    narration,
    ...(transferDate ? { transfer_date: transferDate } : {}),
  });

  if (error) return { error: error.message };

  revalidatePath("/fees/transfers");
  return {};
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

  const { data: created, error } = await supabase
    .from("fee_records")
    .insert({ school_id: schoolId, student_id: studentId, fee_type_id: feeTypeId, session, term, amount_expected: 0 })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function matchTransferAlert(alertId: string, studentId: string, feeTypeId: string) {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: alert } = await supabase
    .from("bank_transfer_alerts")
    .select("id, amount, narration, transfer_date, status")
    .eq("id", alertId)
    .single();

  if (!alert || alert.status !== "unmatched") {
    throw new Error("This alert has already been resolved.");
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

  const { data: payment, error: paymentError } = await supabase
    .from("fee_payments")
    .insert({
      school_id: profile.school_id,
      fee_record_id: feeRecordId,
      amount: alert.amount,
      payment_date: alert.transfer_date,
      method: "transfer",
      reference_number: alert.narration.slice(0, 200),
      recorded_by: profile.id,
    })
    .select("id")
    .single();

  if (paymentError) throw new Error(paymentError.message);

  const { error: alertError } = await supabase
    .from("bank_transfer_alerts")
    .update({ status: "matched", matched_student_id: studentId, matched_fee_payment_id: payment.id })
    .eq("id", alertId);

  if (alertError) throw new Error(alertError.message);

  revalidatePath("/fees/transfers");
  revalidatePath("/fees");
  revalidatePath(`/fees/student/${studentId}`);
}

export async function ignoreTransferAlert(alertId: string) {
  await requireProprietor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_transfer_alerts")
    .update({ status: "ignored" })
    .eq("id", alertId);

  if (error) throw new Error(error.message);
  revalidatePath("/fees/transfers");
}
