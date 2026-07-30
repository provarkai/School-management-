import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Where Supabase's signup-confirmation email (and any future magic-link /
// password-reset emails) sends the user back to. Handles both link shapes
// Supabase can produce depending on the project's email-template settings:
// the recommended "token_hash + type" OTP link, and the older PKCE "code"
// link — either way, a session needs to actually be established here since
// nothing else in this app does that.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/onboarding`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
