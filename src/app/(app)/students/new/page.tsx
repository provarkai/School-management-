import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { NewStudentForm } from "./NewStudentForm";

export default async function NewStudentPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();
  const [{ data: classes }, { data: fieldDefs }] = await Promise.all([
    supabase.from("classes").select("id, name").order("name"),
    supabase
      .from("student_field_definitions")
      .select("id, label, field_type, options")
      .eq("school_id", profile.school_id ?? "")
      .order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/students" label="Students" />
      <h1 className="text-2xl font-bold text-zinc-900">Register student</h1>
      <NewStudentForm classes={classes ?? []} fieldDefs={fieldDefs ?? []} />
    </div>
  );
}
