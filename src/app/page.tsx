import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/authOtp";
import { LandingPage } from "./LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const userResult = await withAuthTimeout(supabase.auth.getUser(), 8000);
  const user = "data" in userResult ? userResult.data.user : null;

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
