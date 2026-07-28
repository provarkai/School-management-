import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Supabase client for Server Components / Server Actions / Route Handlers.
 * Uses the anon key — access is enforced by RLS for the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — safe to ignore because
            // the middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

/**
 * Admin client using the service role key. Server-only — never import from
 * client components. Bypasses RLS, so use narrowly (e.g. creating staff
 * auth accounts) and never forward it to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
