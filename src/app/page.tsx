import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/withAuthTimeout";
import { LandingPage } from "./LandingPage";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await withAuthTimeout(supabase.auth.getUser(), 8000, { user: null });
  const user = data.user;

  if (user) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
