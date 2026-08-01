import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";
import type { AppUser, School } from "@/lib/types";

export interface CurrentUser {
  authId: string;
  profile: AppUser;
  school: School | null;
  /** True for the literal proprietor OR a staff member delegated admin
   * rights. A delegated admin has equal operational power to the
   * proprietor (including payroll/salaries) — use this for essentially
   * every "run the school" access check; use profile.role === "proprietor"
   * directly only for granting/revoking admin status itself, which stays
   * reserved for the literal owner. */
  isManager: boolean;
}

/**
 * Loads the signed-in staff member's profile. Redirects to /login if there is
 * no session, and to /onboarding if the account has not created/joined a
 * school yet.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  // This runs on every protected page (often twice — once in the layout,
  // once in the page itself), so an unbounded call here is the single
  // biggest place a slow/unresponsive Supabase auth server can turn into
  // the whole app appearing to hang after a successful sign-in.
  const { data } = await withAuthTimeout(supabase.auth.getUser(), 8000, { user: null });
  const user = data.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.school_id) {
    redirect("/onboarding");
  }

  const { data: school } = await supabase
    .from("schools")
    .select("*")
    .eq("id", profile.school_id)
    .single();

  if (school?.status === "suspended") {
    redirect("/account-suspended");
  }

  const typedProfile = profile as AppUser;

  return {
    authId: user.id,
    profile: typedProfile,
    school: school as School | null,
    isManager: typedProfile.role === "proprietor" || typedProfile.is_school_admin,
  };
}

/** Allows the literal proprietor OR a delegated school admin. */
export async function requireProprietor(): Promise<CurrentUser> {
  const current = await requireUser();
  if (!current.isManager) {
    redirect("/dashboard");
  }
  return current;
}

/** Allows only the literal proprietor — reserved for granting/revoking
 * admin status itself, which a delegated admin should not be able to reach
 * even though they pass requireProprietor(). */
export async function requireLiteralProprietor(): Promise<CurrentUser> {
  const current = await requireUser();
  if (current.profile.role !== "proprietor") {
    redirect("/dashboard");
  }
  return current;
}
