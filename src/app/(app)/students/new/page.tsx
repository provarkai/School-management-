import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewStudentForm } from "./NewStudentForm";

export default async function NewStudentPage() {
  await requireProprietor();
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Register student</h1>
      <NewStudentForm classes={classes ?? []} />
    </div>
  );
}
