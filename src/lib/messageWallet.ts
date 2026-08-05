import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MOCK_PAYMENTS_BLOCKED_MESSAGE,
  generateReference,
  initializeTransaction,
  isMockPaymentBlocked,
} from "./paystack";

/** Flat rate charged to a school per message send, regardless of purpose.
 * SMSLive247 has no per-channel split we can bill against (see src/lib/sms.ts),
 * so this is a single number rather than separate SMS/WhatsApp prices. */
export const MESSAGE_COST_KOBO = 500; // ₦5.00

/** Preset top-up amounts shown in Settings — kept to a short, round list so
 * a proprietor is picking from options rather than typing an arbitrary figure. */
export const TOPUP_PACKS_NAIRA = [2000, 5000, 10000, 20000];

export function kobo(naira: number): number {
  return Math.round(naira * 100);
}

export function nairaFromKobo(koboAmount: number): number {
  return koboAmount / 100;
}

export interface CreateWalletTopupParams {
  schoolId: string;
  amountNaira: number;
  email: string;
  callbackUrl: string;
  initiatedBy?: string | null;
}

export interface CreateWalletTopupResult {
  ok: boolean;
  mocked: boolean;
  authorizationUrl?: string;
  reference?: string;
  error?: string;
}

/**
 * Creates a message_wallet_topups row and kicks off the Paystack
 * transaction — the wallet equivalent of createPaymentIntent()
 * (src/lib/payments.ts). Uses the service-role admin client, same reasoning:
 * message_wallet_topups has no client-side write policy, so every writer
 * goes through this one trusted path after its own role check passes.
 */
export async function createWalletTopupIntent(
  admin: SupabaseClient,
  params: CreateWalletTopupParams
): Promise<CreateWalletTopupResult> {
  if (isMockPaymentBlocked()) {
    return { ok: false, mocked: true, error: MOCK_PAYMENTS_BLOCKED_MESSAGE };
  }

  const reference = generateReference("msgwallet");

  const init = await initializeTransaction({
    email: params.email,
    amountNaira: params.amountNaira,
    reference,
    callbackUrl: params.callbackUrl,
  });

  if (!init.ok) {
    return { ok: false, mocked: init.mocked, error: init.error };
  }

  const { error } = await admin.from("message_wallet_topups").insert({
    school_id: params.schoolId,
    reference,
    amount_kobo: kobo(params.amountNaira),
    authorization_url: init.authorizationUrl,
    initiated_by: params.initiatedBy ?? null,
  });

  if (error) {
    return { ok: false, mocked: init.mocked, error: error.message };
  }

  return { ok: true, mocked: init.mocked, authorizationUrl: init.authorizationUrl, reference };
}

export interface MarkWalletTopupSuccessResult {
  ok: boolean;
  alreadyProcessed: boolean;
  error?: string;
}

/**
 * Idempotently credits a school's wallet for a confirmed Paystack charge —
 * the wallet equivalent of markPaymentIntentSuccess(). Safe to call twice
 * for the same reference (webhook + redirect callback racing to confirm
 * the same top-up); credit_message_wallet() itself is the thing that makes
 * the second call a no-op.
 */
export async function markWalletTopupSuccess(
  admin: SupabaseClient,
  reference: string,
  settledAmountNaira?: number
): Promise<MarkWalletTopupSuccessResult> {
  const { data: topup } = await admin
    .from("message_wallet_topups")
    .select("id, school_id, amount_kobo, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!topup) {
    return { ok: false, alreadyProcessed: false, error: "Unknown top-up reference." };
  }

  if (topup.status === "success") {
    return { ok: true, alreadyProcessed: true };
  }

  // Credit what was actually paid, not what was requested — same reasoning
  // as fee payments (Paystack can settle for less on some channels).
  const amountKobo =
    typeof settledAmountNaira === "number" && Number.isFinite(settledAmountNaira) && settledAmountNaira > 0
      ? kobo(settledAmountNaira)
      : Number(topup.amount_kobo);

  const { error: creditError } = await admin.rpc("credit_message_wallet", {
    target_school_id: topup.school_id,
    credit_kobo: amountKobo,
    credit_type: "topup",
    credit_description: "Wallet top-up via Paystack",
    reference,
  });

  if (creditError) {
    return { ok: false, alreadyProcessed: false, error: creditError.message };
  }

  const { error: updateError } = await admin
    .from("message_wallet_topups")
    .update({ status: "success", verified_at: new Date().toISOString() })
    .eq("id", topup.id);

  if (updateError) {
    return { ok: false, alreadyProcessed: false, error: updateError.message };
  }

  return { ok: true, alreadyProcessed: false };
}

/** Current balance in kobo — a plain sum over whatever rows RLS lets the
 * caller see, which for message_wallet_transactions is already scoped to
 * the caller's own school (proprietor-only select policy, 0082), so no
 * separate school_id filter is needed here. */
export async function getWalletBalanceKobo(supabase: SupabaseClient, schoolId: string): Promise<number> {
  const { data } = await supabase
    .from("message_wallet_transactions")
    .select("amount_kobo")
    .eq("school_id", schoolId);

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount_kobo), 0);
}
