import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (profile?.school_id) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Set up your school
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          You&apos;ll be the proprietor/admin for this school.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
