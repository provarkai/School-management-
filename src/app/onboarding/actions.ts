"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/authOtp";

export interface OnboardingState {
  error?: string;
}

export async function createSchool(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");

  if (!name) {
    return { error: "School name is required." };
  }
  if (gender !== "male" && gender !== "female") {
    return { error: "Choose Proprietor or Proprietress." };
  }

  const supabase = await createClient();
  const userResult = await withAuthTimeout(supabase.auth.getUser(), 8000);
  const user = "data" in userResult ? userResult.data.user : null;

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("bootstrap_school", {
    school_name: name,
    school_address: address || null,
    proprietor_gender: gender,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
