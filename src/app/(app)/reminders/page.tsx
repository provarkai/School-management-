import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { RemindersTable } from "./RemindersTable";
import { GeneralAnnouncementForm } from "./GeneralAnnouncementForm";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { profile, school } = await requireProprietor();
  const { class: classFilter } = await searchParams;
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: fees }, { data: students }, { data: classes }] = await Promise.all([
    supabase
      .from("fee_summary")
      .select("student_id, balance, fee_type_name, status")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", term)
      .neq("status", "paid"),
    supabase.from("students").select("id, full_name, class_id, parent_phone").eq("status", "active"),
    supabase.from("classes").select("id, name"),
  ]);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const balanceByStudent = new Map<string, number>();
  for (const f of fees ?? []) {
    if (Number(f.balance) <= 0) continue;
    balanceByStudent.set(f.student_id, (balanceByStudent.get(f.student_id) ?? 0) + Number(f.balance));
  }

  const owing = Array.from(balanceByStudent.entries())
    .map(([studentId, balance]) => {
      const student = studentById.get(studentId);
      return {
        id: studentId,
        full_name: student?.full_name ?? "Unknown",
        className: student?.class_id ? classNameById.get(student.class_id) ?? "—" : "—",
        class_id: student?.class_id ?? null,
        parent_phone: student?.parent_phone ?? null,
        balance,
      };
    })
    .filter((s) => (classFilter ? s.class_id === classFilter : true))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Reminders</h1>
        <p className="text-sm text-zinc-500">
          Fee reminders sum a student&apos;s balance across every fee type (school fees, PTA
          levy, etc). Use the general announcement below for anything else.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Fee reminders
        </h2>

        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/reminders"
            className={`rounded-full px-3 py-1 ${
              !classFilter ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            All classes
          </Link>
          {(classes ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/reminders?class=${c.id}`}
              className={`rounded-full px-3 py-1 ${
                classFilter === c.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <RemindersTable students={owing} />
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          General announcement
        </h2>
        <p className="text-sm text-zinc-500">
          Send any other message to parents — events, closures, PTA meetings — not tied to fees.
        </p>
        <GeneralAnnouncementForm classes={classes ?? []} />
      </section>
    </div>
  );
}
