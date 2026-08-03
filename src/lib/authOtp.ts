import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Shared handler for the two link shapes Supabase's auth emails can produce
 * (token_hash+type, or a PKCE code) — used by both the signup-confirmation
 * and password-recovery callback routes, which only differ in where they
 * send the user once a session is established.
 */
export async function handleAuthEmailLink(
  request: Request,
  successPath: string,
  parentSuccessPath: string
): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  let userId: string | null = null;

  if (tokenHash && type) {
    const { data, error } = await withAuthTimeout(
      supabase.auth.verifyOtp({ type, token_hash: tokenHash }),
      15000,
      { user: null, session: null }
    );
    if (error) return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
    userId = data.user?.id ?? null;
  } else if (code) {
    const { data, error } = await withAuthTimeout(supabase.auth.exchangeCodeForSession(code), 15000, {
      user: null,
      session: null,
    });
    if (error) return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
    userId = data.user?.id ?? null;
  } else {
    return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
  }

  // An account is staff OR a parent, never both (the signup trigger creates
  // exactly one of the two rows). Both destinations here are staff-only
  // routes, so a parent confirming their email — or resetting their
  // password — would otherwise be bounced straight back out to a staff
  // login with no explanation.
  if (userId) {
    const { data: staffProfile } = await withAuthTimeout(
      supabase.from("app_users").select("id").eq("id", userId).maybeSingle(),
      8000,
      null
    );
    if (!staffProfile) return NextResponse.redirect(`${origin}${parentSuccessPath}`);
  }

  return NextResponse.redirect(`${origin}${successPath}`);
}
