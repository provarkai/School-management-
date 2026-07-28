import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { RemindersTable } from "./RemindersTable";

export default async function RemindersPage() {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: fees }, { data: students }, { data: classes }] = await Promise.all([
    supabase
      .from("fee_summary")
      .select("student_id, balance, status")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", term)
      .neq("status", "paid"),
    supabase.from("students").select("id, full_name, class_id, parent_phone").eq("status", "active"),
    supabase.from("classes").select("id, name"),
  ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const owing = (fees ?? [])
    .filter((f) => Number(f.balance) > 0)
    .map((f) => {
      const student = studentById.get(f.student_id);
      return {
        id: f.student_id,
        full_name: student?.full_name ?? "Unknown",
        className: student?.class_id ? classNameById.get(student.class_id) ?? "—" : "—",
        parent_phone: student?.parent_phone ?? null,
        balance: Number(f.balance),
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Reminders</h1>
        <p className="text-sm text-zinc-500">
          Sends: &ldquo;Dear [Parent], this is a reminder that [Student]&apos;s school fees
          balance of ₦[Amount] for {`[Term]`} is outstanding…&rdquo;
        </p>
      </div>

      <RemindersTable students={owing} />
    </div>
  );
}
