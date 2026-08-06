/**
 * Paystack (https://paystack.com) checkout wrapper — Nigerian payment
 * gateway used to let parents pay school fees online and have the payment
 * auto-reconcile against the right fee record via a generated reference.
 *
 * In "mock" mode (no PAYSTACK_SECRET_KEY set) transactions are simulated
 * instead of hitting the real API, so the payment flow is fully testable
 * before real credentials exist — same pattern as src/lib/sms.ts.
 */

import { randomBytes } from "node:crypto";
import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function isMockMode(): boolean {
  return !process.env.PAYSTACK_SECRET_KEY;
}

/**
 * Mock mode simulates an *instant successful payment*: a parent taps "Pay
 * now", is bounced straight to /pay/callback, and the fee is marked paid
 * without a naira moving. That is exactly right for testing and a live
 * demo, and exactly wrong for a school that has gone live and simply
 * forgot to set PAYSTACK_SECRET_KEY — the failure is silent and it writes
 * false payment records into the books.
 *
 * So in a production deployment, refuse to start a payment at all rather
 * than fake one. Set ALLOW_MOCK_PAYMENTS=1 to keep the simulated flow in
 * production anyway (a demo deployment on purpose, not by accident).
 */
export function isMockPaymentBlocked(): boolean {
  if (!isMockMode()) return false;
  if (process.env.ALLOW_MOCK_PAYMENTS === "1") return false;
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export const MOCK_PAYMENTS_BLOCKED_MESSAGE =
  "Online payments aren't set up for this school yet. Ask whoever manages the app to add a Paystack secret key.";

export function generateReference(prefix = "schfee"): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Fee pass-through: gross-up a fee so the payer (not the school) covers both
// Paystack's own processing fee and the platform's flat cut. See
// src/lib/payments.ts for where this plugs into a payment intent, and the
// `charged_amount`/`platform_fee`/`paystack_fee_estimate` columns added to
// payment_intents by 0083 for how the breakdown is kept for the record.
// ---------------------------------------------------------------------------

/**
 * Paystack's standard Nigeria card rate: 1.5% + ₦100, flat fee waived under
 * ₦2,500, capped at ₦2,000 total. Paystack also offers a discounted
 * education-sector rate (0.7%, capped ₦1,500) — but only once a school (or
 * this platform, on the schools' behalf) has actually registered for it
 * with Paystack, which is an account-level step outside this codebase. Flip
 * these three constants once that's done; nothing else needs to change.
 */
export const PAYSTACK_PERCENTAGE_FEE = 0.015;
export const PAYSTACK_FLAT_FEE_NAIRA = 100;
export const PAYSTACK_FLAT_FEE_WAIVED_UNDER_NAIRA = 2500;
export const PAYSTACK_FEE_CAP_NAIRA = 2000;

/** The platform's own flat cut per fee payment, passed through to the payer
 * alongside Paystack's fee (see calculateGrossAmount). Adjust freely — it's
 * read from nowhere else, so changing it takes effect on the next payment. */
export const PLATFORM_FLAT_FEE_NAIRA = 100;

export interface FeeBreakdown {
  /** What the school is owed and what gets credited to the fee balance. */
  netNaira: number;
  /** Paystack's own processing fee, estimated with their published formula
   * (the real fee Paystack reports on verify can differ by a few kobo from
   * rounding — close enough that the platform absorbs any tiny gap rather
   * than the family being shorted or overcharged on a later payment). */
  paystackFeeNaira: number;
  /** The platform's flat cut. */
  platformFeeNaira: number;
  /** netNaira + paystackFeeNaira + platformFeeNaira, rounded to the naira —
   * this is the amount actually charged to the payer's card. */
  grossNaira: number;
}

/**
 * Grosses up a fee so that after Paystack deducts its own processing fee,
 * the school's subaccount still nets exactly `netNaira` — and on top,
 * carries the platform's flat cut so that doesn't come out of the school's
 * share either. Standard "who bears the card fee" gross-up math:
 * `gross = (net + platformFee + paystackFlatFee) / (1 - paystackPercentage)`,
 * except once the percentage fee would exceed Paystack's cap, the fee is
 * just the cap and the formula collapses to simple addition.
 */
export function calculateGrossAmount(netNaira: number, platformFeeNaira = PLATFORM_FLAT_FEE_NAIRA): FeeBreakdown {
  if (netNaira <= 0) {
    return { netNaira, paystackFeeNaira: 0, platformFeeNaira: 0, grossNaira: netNaira };
  }

  const beforeCap = (netNaira + platformFeeNaira + PAYSTACK_FLAT_FEE_NAIRA) / (1 - PAYSTACK_PERCENTAGE_FEE);
  const paystackFeeUncapped = beforeCap - netNaira - platformFeeNaira;

  let grossNaira: number;
  let paystackFeeNaira: number;
  if (paystackFeeUncapped > PAYSTACK_FEE_CAP_NAIRA) {
    paystackFeeNaira = PAYSTACK_FEE_CAP_NAIRA;
    grossNaira = netNaira + platformFeeNaira + paystackFeeNaira;
  } else {
    grossNaira = beforeCap;
    paystackFeeNaira = paystackFeeUncapped;
  }

  // The flat ₦100 is waived by Paystack under ₦2,500 — re-derive without it
  // for small payments rather than over-collecting a fee Paystack won't
  // actually charge.
  if (grossNaira < PAYSTACK_FLAT_FEE_WAIVED_UNDER_NAIRA) {
    const withoutFlat = (netNaira + platformFeeNaira) / (1 - PAYSTACK_PERCENTAGE_FEE);
    if (withoutFlat < PAYSTACK_FLAT_FEE_WAIVED_UNDER_NAIRA) {
      grossNaira = withoutFlat;
      paystackFeeNaira = withoutFlat - netNaira - platformFeeNaira;
    }
  }

  grossNaira = Math.round(grossNaira);
  paystackFeeNaira = Math.round(grossNaira - netNaira - platformFeeNaira);

  return { netNaira, paystackFeeNaira, platformFeeNaira, grossNaira };
}

export interface InitializeResult {
  ok: boolean;
  mocked: boolean;
  authorizationUrl?: string;
  error?: string;
}

export async function initializeTransaction(params: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  /** The school's subaccount code (schools.paystack_subaccount_code) — when
   * set, Paystack settles the split directly to the school's own bank
   * account instead of the platform's main account. */
  subaccountCode?: string;
  /** Flat amount (naira) that goes to the platform's main account instead
   * of the subaccount, overriding the subaccount's stored default split.
   * Only meaningful alongside subaccountCode. */
  transactionChargeNaira?: number;
}): Promise<InitializeResult> {
  if (isMockMode()) {
    return {
      ok: true,
      mocked: true,
      authorizationUrl: `${params.callbackUrl}?reference=${params.reference}&mock=1`,
    };
  }

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amountNaira * 100), // kobo
        reference: params.reference,
        callback_url: params.callbackUrl,
        ...(params.subaccountCode ? { subaccount: params.subaccountCode } : {}),
        ...(params.transactionChargeNaira !== undefined
          ? { transaction_charge: Math.round(params.transactionChargeNaira * 100) }
          : {}),
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
      return { ok: false, mocked: false, error: json.message ?? `Paystack error ${res.status}` };
    }

    return { ok: true, mocked: false, authorizationUrl: json.data.authorization_url };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      error: err instanceof Error ? err.message : "Unknown error contacting Paystack",
    };
  }
}

export interface VerifyResult {
  ok: boolean;
  mocked: boolean;
  success: boolean;
  amountNaira?: number;
  error?: string;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (isMockPaymentBlocked()) {
    // /pay/callback is a public page, so an unconditional mock "success"
    // here is a way to confirm any pending reference without paying.
    return { ok: false, mocked: true, success: false, error: MOCK_PAYMENTS_BLOCKED_MESSAGE };
  }

  if (isMockMode()) {
    return { ok: true, mocked: true, success: true };
  }

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
      return { ok: false, mocked: false, success: false, error: json.message ?? `Paystack error ${res.status}` };
    }

    return {
      ok: true,
      mocked: false,
      success: json.data.status === "success",
      amountNaira: Number(json.data.amount) / 100,
    };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error contacting Paystack",
    };
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (isMockMode()) return false; // no real webhooks possible without a secret key
  if (!signature) return false;

  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");

  const hashBuffer = Buffer.from(hash, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  // Constant-time comparison — a plain === leaks timing information about
  // how many leading bytes matched, which is the textbook attack against
  // HMAC verification (irrelevant over a noisy network in practice, but
  // free to close off).
  return (
    hashBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(hashBuffer, signatureBuffer)
  );
}

// ---------------------------------------------------------------------------
// Subaccounts — settlement setup, done once per school in Settings
// (src/app/(app)/profile/OnlinePaymentsSection.tsx).
// ---------------------------------------------------------------------------

export interface Bank {
  name: string;
  code: string;
}

export interface ListBanksResult {
  ok: boolean;
  mocked: boolean;
  banks: Bank[];
  error?: string;
}

// A short, real list of major Nigerian banks (name + real Paystack bank
// code) so the settlement-bank dropdown works end-to-end in mock mode —
// same "exercise the whole flow without credentials" principle as every
// other mock path in this codebase.
const MOCK_BANKS: Bank[] = [
  { name: "Access Bank", code: "044" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Opay", code: "999992" },
  { name: "Moniepoint MFB", code: "50515" },
];

export async function listBanks(): Promise<ListBanksResult> {
  if (isMockMode()) {
    return { ok: true, mocked: true, banks: MOCK_BANKS };
  }

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/bank?country=nigeria&perPage=100`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
      return { ok: false, mocked: false, banks: [], error: json.message ?? `Paystack error ${res.status}` };
    }

    const banks = (json.data as { name: string; code: string }[]).map((b) => ({ name: b.name, code: b.code }));
    return { ok: true, mocked: false, banks };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      banks: [],
      error: err instanceof Error ? err.message : "Unknown error contacting Paystack",
    };
  }
}

export interface ResolveAccountResult {
  ok: boolean;
  mocked: boolean;
  accountName?: string;
  error?: string;
}

/**
 * Confirms an account number actually belongs to the name on file before a
 * subaccount is created — the same "resolve, then let the human confirm"
 * step every Nigerian fintech app does, so a mistyped digit doesn't quietly
 * route a school's fee income to a stranger's account.
 */
export async function resolveBankAccount(accountNumber: string, bankCode: string): Promise<ResolveAccountResult> {
  if (isMockMode()) {
    return { ok: true, mocked: true, accountName: "TEST ACCOUNT (mock — no real verification)" };
  }

  try {
    const res = await fetch(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const json = await res.json();
    if (!res.ok || !json.status) {
      return { ok: false, mocked: false, error: json.message ?? "Could not verify that account number." };
    }

    return { ok: true, mocked: false, accountName: json.data.account_name };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      error: err instanceof Error ? err.message : "Unknown error contacting Paystack",
    };
  }
}

export interface CreateSubaccountResult {
  ok: boolean;
  mocked: boolean;
  subaccountCode?: string;
  error?: string;
}

/**
 * Registers a school as a Paystack subaccount so its share of every future
 * fee payment settles straight to its own bank account. percentageCharge is
 * the subaccount's *stored default* split (Paystack requires one), but
 * every payment this app initializes overrides it per-transaction with
 * transaction_charge (see calculateGrossAmount/createPaymentIntent) — 0 is
 * passed here so the stored default never accidentally applies on its own.
 */
export async function createSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
}): Promise<CreateSubaccountResult> {
  if (isMockMode()) {
    return { ok: true, mocked: true, subaccountCode: `SUB_mock_${randomBytes(6).toString("hex")}` };
  }

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/subaccount`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: params.businessName,
        settlement_bank: params.bankCode,
        account_number: params.accountNumber,
        percentage_charge: 0,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.status) {
      return { ok: false, mocked: false, error: json.message ?? `Paystack error ${res.status}` };
    }

    return { ok: true, mocked: false, subaccountCode: json.data.subaccount_code };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      error: err instanceof Error ? err.message : "Unknown error contacting Paystack",
    };
  }
}
