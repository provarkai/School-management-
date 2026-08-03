import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";

const PUBLIC_PATHS = ["/login", "/signup", "/parent/login"];

export async function updateSession(request: NextRequest) {
  // Public, tokenized views and API routes — no cookie-based auth to check;
  // API routes authenticate themselves (webhook signatures, bearer secrets).
  // /check-result is the result-checker PIN page: also no session, since
  // its access control is the serial + PIN + admission number entered on
  // the page itself, not a login.
  // /privacy is a legal document anyone should be able to read regardless of
  // sign-in state, so it's exempt from both the "must be signed in" redirect
  // and the "signed in users get bounced off public pages" redirect below.
  // /auth/* routes (email confirmation, password recovery) are hit by a
  // signed-out browser clicking a link from an email — they establish the
  // session themselves, so they can't be gated behind "must already be
  // signed in".
  // /parent/invite/[token] shows who/what the link is for before asking
  // anyone to sign in or create an account — forcing a redirect to
  // /parent/login first (which is what would otherwise happen, since it's
  // under /parent/*) would mean committing to a login before seeing that.
  // The page checks the session itself once it renders.
  if (
    request.nextUrl.pathname.startsWith("/p/") ||
    request.nextUrl.pathname.startsWith("/t/") ||
    request.nextUrl.pathname.startsWith("/pay/") ||
    request.nextUrl.pathname.startsWith("/check-result") ||
    request.nextUrl.pathname.startsWith("/parent/invite/") ||
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname.startsWith("/auth/") ||
    request.nextUrl.pathname.startsWith("/privacy")
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // supabase.auth.getUser() can, in rare cases (a stale/invalid refresh
  // token colliding with a transient hiccup on Supabase's end), retry
  // internally with backoff for up to ~30s — and since this middleware runs
  // on every navigation, that turns into the whole app appearing to hang
  // until the browser's cookies are cleared by hand. Bound the wait, and if
  // it's exceeded, drop whatever Supabase auth cookies are on the request
  // so the *next* request starts clean instead of repeating the same stall.
  let timedOut = false;
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, 8000)
    ),
  ]).catch(() => null);

  if (timedOut) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) {
        response.cookies.delete(cookie.name);
      }
    }
  }

  const { pathname } = request.nextUrl;
  const isParentArea = pathname.startsWith("/parent");
  const isPublicPath = pathname === "/" || PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL(isParentArea ? "/parent/login" : "/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath) {
    // Same account can only be staff OR a parent (the signup trigger creates
    // exactly one of the two rows) — figure out which so we don't bounce a
    // parent back toward the staff dashboard (or vice versa) in a loop.
    const { data: staffProfile } = await withAuthTimeout(
      supabase.from("app_users").select("id").eq("id", user.id).maybeSingle(),
      8000,
      null
    );

    return NextResponse.redirect(new URL(staffProfile ? "/dashboard" : "/parent", request.url));
  }

  return response;
}
