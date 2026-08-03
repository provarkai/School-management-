import { headers } from "next/headers";

/**
 * The app's own public origin, for links that leave the app and come back:
 * Supabase auth email redirects (signup confirmation, password recovery)
 * and the Paystack checkout callback.
 *
 * Prefers the configured APP_URL and only falls back to the request's Host
 * header. The header is set by whoever made the request, so deriving a
 * password-reset link from it means an attacker who sends
 * `Host: attacker.example` to /login gets Supabase to mail *your user* a
 * recovery link pointing at their domain — and with it, the token. Supabase's
 * Redirect URL allow-list is the backstop, but allow-lists are routinely
 * widened to a wildcard (`https://*.vercel.app/**` covers every preview
 * deployment, and every attacker-registered project on that domain too), so
 * this should not be the only thing standing in the way.
 *
 * Set APP_URL (or NEXT_PUBLIC_APP_URL) in production. Without it the
 * fallback keeps local development and preview deployments working exactly
 * as before.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  // Vercel sets this for every deployment, including previews, so a project
  // that never sets APP_URL still gets a trustworthy origin rather than the
  // caller's header.
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}
