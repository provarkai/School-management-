import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCronRequest } from "./cronAuth.ts";

function req(authorization?: string): Request {
  return new Request("https://example.test/api/cron/backup-schools", {
    headers: authorization ? { authorization } : {},
  });
}

test("accepts the configured secret", (t) => {
  t.after(() => delete process.env.CRON_SECRET);
  process.env.CRON_SECRET = "s3cret-value";
  assert.equal(isAuthorizedCronRequest(req("Bearer s3cret-value")), true);
});

test("rejects a wrong secret, a missing header and a bare token", (t) => {
  t.after(() => delete process.env.CRON_SECRET);
  process.env.CRON_SECRET = "s3cret-value";
  assert.equal(isAuthorizedCronRequest(req("Bearer wrong")), false);
  assert.equal(isAuthorizedCronRequest(req()), false);
  assert.equal(isAuthorizedCronRequest(req("s3cret-value")), false);
});

test("rejects everything when CRON_SECRET is unset", () => {
  // The regression this guards: building the expected header by template
  // interpolation turns an unset secret into the literal "Bearer undefined",
  // which anyone can send. CRON_SECRET is optional in .env.example and has
  // to be added by hand in Vercel, so unset is a state real deployments are
  // in — and these routes blast SMS to every parent and dump every school
  // to object storage.
  delete process.env.CRON_SECRET;
  assert.equal(isAuthorizedCronRequest(req("Bearer undefined")), false);
  assert.equal(isAuthorizedCronRequest(req("Bearer ")), false);
  assert.equal(isAuthorizedCronRequest(req("Bearer null")), false);
  assert.equal(isAuthorizedCronRequest(req()), false);

  process.env.CRON_SECRET = "";
  assert.equal(isAuthorizedCronRequest(req("Bearer undefined")), false);
  assert.equal(isAuthorizedCronRequest(req("Bearer ")), false);
});
