import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Loads the signed-in user and confirms they're a platform admin. Redirects
 * to /login if there's no session, and to /dashboard if the account isn't
 * a platform admin — this route is never linked from the app itself.
 */
export async function requirePlatformAdmin(): Promise<{ authId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return { authId: user.id };
}
