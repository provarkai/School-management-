import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/parent/login"];

export async function updateSession(request: NextRequest) {
  // Public, tokenized views and API routes — no cookie-based auth to check;
  // API routes authenticate themselves (webhook signatures, bearer secrets).
  if (
    request.nextUrl.pathname.startsWith("/p/") ||
    request.nextUrl.pathname.startsWith("/t/") ||
    request.nextUrl.pathname.startsWith("/pay/") ||
    request.nextUrl.pathname.startsWith("/api/")
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isParentArea = pathname.startsWith("/parent");
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL(isParentArea ? "/parent/login" : "/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicPath) {
    // Same account can only be staff OR a parent (the signup trigger creates
    // exactly one of the two rows) — figure out which so we don't bounce a
    // parent back toward the staff dashboard (or vice versa) in a loop.
    const { data: staffProfile } = await supabase
      .from("app_users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.redirect(new URL(staffProfile ? "/dashboard" : "/parent", request.url));
  }

  return response;
}
