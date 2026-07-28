import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, School } from "@/lib/types";

export interface CurrentUser {
  authId: string;
  profile: AppUser;
  school: School | null;
}

/**
 * Loads the signed-in staff member's profile. Redirects to /login if there is
 * no session, and to /onboarding if the account has not created/joined a
 * school yet.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return { authId: user.id, profile: profile as AppUser, school: school as School | null };
}

export async function requireProprietor(): Promise<CurrentUser> {
  const current = await requireUser();
  if (current.profile.role !== "proprietor") {
    redirect("/dashboard");
  }
  return current;
}
