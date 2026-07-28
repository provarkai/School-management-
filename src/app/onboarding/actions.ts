"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
}

export async function createSchool(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name) {
    return { error: "School name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("bootstrap_school", {
    school_name: name,
    school_address: address || null,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
