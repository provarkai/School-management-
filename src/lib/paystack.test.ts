import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { generateReference, isMockMode, isMockPaymentBlocked, verifyWebhookSignature } from "./paystack.ts";

const KEY = "sk_test_abc123";

function sign(body: string, key = KEY): string {
  return crypto.createHmac("sha512", key).update(body).digest("hex");
}

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("accepts a correctly signed webhook body", () => {
  withEnv({ PAYSTACK_SECRET_KEY: KEY }, () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "schfee_x" } });
    assert.equal(verifyWebhookSignature(body, sign(body)), true);
  });
});

test("rejects a tampered body, a wrong key, and a missing signature", () => {
  withEnv({ PAYSTACK_SECRET_KEY: KEY }, () => {
    const body = JSON.stringify({ event: "charge.success", data: { amount: 100 } });
    const tampered = JSON.stringify({ event: "charge.success", data: { amount: 999999 } });

    assert.equal(verifyWebhookSignature(tampered, sign(body)), false);
    assert.equal(verifyWebhookSignature(body, sign(body, "sk_test_other")), false);
    assert.equal(verifyWebhookSignature(body, null), false);
    assert.equal(verifyWebhookSignature(body, ""), false);
  });
});

test("rejects a signature of the wrong length instead of throwing", () => {
  // timingSafeEqual throws on a length mismatch — an unguarded compare would
  // turn a junk signature into a 500 rather than a clean 401.
  withEnv({ PAYSTACK_SECRET_KEY: KEY }, () => {
    assert.equal(verifyWebhookSignature("{}", "abcd"), false);
    assert.equal(verifyWebhookSignature("{}", "zz"), false);
  });
});

test("no webhook can be verified without a secret key configured", () => {
  withEnv({ PAYSTACK_SECRET_KEY: undefined }, () => {
    assert.equal(isMockMode(), true);
    assert.equal(verifyWebhookSignature("{}", sign("{}")), false);
  });
});

test("mock payments are blocked in production unless explicitly allowed", () => {
  // Mock mode marks a fee paid the instant a parent taps "Pay now". Fine for
  // a demo; a silent hole in the books for a school that went live without
  // setting PAYSTACK_SECRET_KEY.
  withEnv({ PAYSTACK_SECRET_KEY: undefined, VERCEL_ENV: "production", ALLOW_MOCK_PAYMENTS: undefined }, () => {
    assert.equal(isMockPaymentBlocked(), true);
  });

  withEnv({ PAYSTACK_SECRET_KEY: undefined, VERCEL_ENV: "production", ALLOW_MOCK_PAYMENTS: "1" }, () => {
    assert.equal(isMockPaymentBlocked(), false);
  });

  withEnv({ PAYSTACK_SECRET_KEY: KEY, VERCEL_ENV: "production", ALLOW_MOCK_PAYMENTS: undefined }, () => {
    assert.equal(isMockPaymentBlocked(), false);
  });
});

test("payment references are unique and unguessable", () => {
  const refs = new Set(Array.from({ length: 500 }, () => generateReference()));
  assert.equal(refs.size, 500);
  for (const ref of refs) {
    assert.match(ref, /^schfee_[0-9a-f]{24}$/);
  }
});
