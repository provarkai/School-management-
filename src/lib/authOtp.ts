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
export async function handleAuthEmailLink(request: Request, successPath: string): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await withAuthTimeout(
      supabase.auth.verifyOtp({ type, token_hash: tokenHash }),
      15000,
      { user: null, session: null }
    );
    if (!error) return NextResponse.redirect(`${origin}${successPath}`);
  } else if (code) {
    const { error } = await withAuthTimeout(supabase.auth.exchangeCodeForSession(code), 15000, {
      user: null,
      session: null,
    });
    if (!error) return NextResponse.redirect(`${origin}${successPath}`);
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
