import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  calculateGrossAmount,
  generateReference,
  isMockMode,
  isMockPaymentBlocked,
  verifyWebhookSignature,
  PAYSTACK_FEE_CAP_NAIRA,
  PAYSTACK_FLAT_FEE_WAIVED_UNDER_NAIRA,
} from "./paystack.ts";

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

test("payment references can carry a caller-chosen prefix", () => {
  // The Paystack webhook (src/app/api/paystack/webhook/route.ts) routes a
  // fee payment vs. a message-wallet top-up by this exact prefix.
  const ref = generateReference("msgwallet");
  assert.match(ref, /^msgwallet_[0-9a-f]{24}$/);
});

test("calculateGrossAmount: the school always nets exactly what was asked, whatever gets added on top", () => {
  // The core invariant a fee-inclusive charge has to hold: net + platform
  // fee + Paystack's fee always reconstructs the gross amount that gets
  // charged to the card — nothing here should be free-floating math that
  // could drift and short the school a few naira.
  for (const [net, platformFee] of [
    [25000, 100],
    [5000, 100],
    [150000, 250],
    [300000, 100], // large enough to hit the Paystack fee cap
    [1000, 50], // small enough for the flat ₦100 to be waived
  ]) {
    const b = calculateGrossAmount(net, platformFee);
    assert.equal(b.netNaira, net);
    assert.equal(b.platformFeeNaira, platformFee);
    assert.equal(b.netNaira + b.platformFeeNaira + b.paystackFeeNaira, b.grossNaira);
  }
});

test("calculateGrossAmount caps Paystack's estimated fee at the published cap", () => {
  const b = calculateGrossAmount(300000, 100);
  assert.equal(b.paystackFeeNaira, PAYSTACK_FEE_CAP_NAIRA);
});

test("calculateGrossAmount drops the flat ₦100 once the gross would stay under the waiver threshold", () => {
  const b = calculateGrossAmount(1000, 50);
  assert.ok(b.grossNaira < PAYSTACK_FLAT_FEE_WAIVED_UNDER_NAIRA);
  // Reconstructing without the flat fee should match exactly what the
  // function produced — i.e. it actually took the waiver, not just
  // happened to land under the threshold by coincidence.
  const withoutFlatFee = (1000 + 50) / (1 - 0.015);
  assert.ok(Math.abs(b.grossNaira - withoutFlatFee) < 1);
});

test("calculateGrossAmount is a no-op for a zero or negative balance", () => {
  assert.deepEqual(calculateGrossAmount(0, 100), {
    netNaira: 0,
    paystackFeeNaira: 0,
    platformFeeNaira: 0,
    grossNaira: 0,
  });
});
