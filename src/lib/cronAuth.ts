import { timingSafeEqual } from "node:crypto";

/**
 * Authenticates a Vercel Cron request against CRON_SECRET.
 *
 * The obvious spelling of this check —
 *   `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``
 * — has a hole worth naming: when CRON_SECRET is unset, template
 * interpolation turns `undefined` into the literal string "undefined", so
 * the expected header becomes "Bearer undefined" and anyone who sends that
 * exact value is authenticated. CRON_SECRET is optional in .env.example and
 * has to be added by hand in the Vercel dashboard, so "unset" is the state
 * a fresh deployment is actually in.
 *
 * Fail closed instead: no secret configured means no caller can pass.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authHeader);

  // timingSafeEqual throws on a length mismatch, so compare lengths first —
  // the length of a bearer token is not the secret.
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** The 401 both cron routes return, so the two stay identical. */
export function cronUnauthorizedResponse(): Response {
  return new Response("Unauthorized", { status: 401 });
}
