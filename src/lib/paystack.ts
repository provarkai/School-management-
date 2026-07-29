/**
 * Paystack (https://paystack.com) checkout wrapper — Nigerian payment
 * gateway used to let parents pay school fees online and have the payment
 * auto-reconcile against the right fee record via a generated reference.
 *
 * In "mock" mode (no PAYSTACK_SECRET_KEY set) transactions are simulated
 * instead of hitting the real API, so the payment flow is fully testable
 * before real credentials exist — same pattern as src/lib/termii.ts.
 */

import { randomBytes } from "node:crypto";
import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function isMockMode(): boolean {
  return !process.env.PAYSTACK_SECRET_KEY;
}

export function generateReference(prefix = "schfee"): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
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
