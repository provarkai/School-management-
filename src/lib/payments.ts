import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MOCK_PAYMENTS_BLOCKED_MESSAGE,
  generateReference,
  initializeTransaction,
  isMockPaymentBlocked,
} from "./paystack";

export interface CreatePaymentIntentParams {
  schoolId: string;
  feeRecordId: string;
  studentId: string;
  amountNaira: number;
  email: string;
  callbackUrl: string;
  initiatedBy?: string | null;
}

export interface CreatePaymentIntentResult {
  ok: boolean;
  mocked: boolean;
  authorizationUrl?: string;
  reference?: string;
  error?: string;
}

/**
 * Creates a payment_intents row and kicks off the Paystack transaction.
 * Uses the service-role admin client — payment_intents has no client-side
 * write policy, so all writers (parent flow, staff flow, webhook) go through
 * this same trusted path after their own role/ownership checks pass.
 */
export async function createPaymentIntent(
  admin: SupabaseClient,
  params: CreatePaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  if (isMockPaymentBlocked()) {
    return { ok: false, mocked: true, error: MOCK_PAYMENTS_BLOCKED_MESSAGE };
  }

  const reference = generateReference();

  const init = await initializeTransaction({
    email: params.email,
    amountNaira: params.amountNaira,
    reference,
    callbackUrl: params.callbackUrl,
  });

  if (!init.ok) {
    return { ok: false, mocked: init.mocked, error: init.error };
  }

  const { error } = await admin.from("payment_intents").insert({
    school_id: params.schoolId,
    fee_record_id: params.feeRecordId,
    student_id: params.studentId,
    reference,
    amount: params.amountNaira,
    authorization_url: init.authorizationUrl,
    initiated_by: params.initiatedBy ?? null,
  });

  if (error) {
    return { ok: false, mocked: init.mocked, error: error.message };
  }

  return { ok: true, mocked: init.mocked, authorizationUrl: init.authorizationUrl, reference };
}

export interface MarkPaymentSuccessResult {
  ok: boolean;
  alreadyProcessed: boolean;
  error?: string;
}

/**
 * Idempotently posts a fee_payments row for a successful Paystack charge.
 * Safe to call twice for the same reference (webhook + redirect callback
 * both racing to confirm the same payment) — the second call is a no-op.
 */
export async function markPaymentIntentSuccess(
  admin: SupabaseClient,
  reference: string,
  /** The amount Paystack confirmed was actually charged, when the caller
   * has verified it. Falls back to the intent's amount when absent (the
   * webhook path, where the event body is the only source). */
  settledAmountNaira?: number
): Promise<MarkPaymentSuccessResult> {
  const { data: intent } = await admin
    .from("payment_intents")
    .select("id, school_id, fee_record_id, amount, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!intent) {
    return { ok: false, alreadyProcessed: false, error: "Unknown payment reference." };
  }

  if (intent.status === "success") {
    return { ok: true, alreadyProcessed: true };
  }

  // Credit what was actually paid, not what we asked for. Paystack can
  // settle a charge for less than the requested amount (partial payment on
  // some channels), and crediting the requested figure would mark a fee
  // cleared that the school was never paid in full for.
  const amount =
    typeof settledAmountNaira === "number" && Number.isFinite(settledAmountNaira) && settledAmountNaira > 0
      ? settledAmountNaira
      : Number(intent.amount);

  const { data: payment, error: paymentError } = await admin
    .from("fee_payments")
    .insert({
      school_id: intent.school_id,
      fee_record_id: intent.fee_record_id,
      amount,
      method: "paystack",
      reference_number: reference,
    })
    .select("id")
    .single();

  if (paymentError) {
    return { ok: false, alreadyProcessed: false, error: paymentError.message };
  }

  const { error: updateError } = await admin
    .from("payment_intents")
    .update({ status: "success", fee_payment_id: payment.id, verified_at: new Date().toISOString() })
    .eq("id", intent.id);

  if (updateError) {
    return { ok: false, alreadyProcessed: false, error: updateError.message };
  }

  return { ok: true, alreadyProcessed: false };
}
