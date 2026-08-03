import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { ThreadRecipientKind, ThreadStatus } from "@/lib/types";

export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { profile, isManager } = await requireUser();
  const { status: statusFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("message_threads")
    .select(
      "id, student_id, parent_id, recipient_kind, teacher_id, status, last_message_at, staff_last_read_at"
    )
    .eq("school_id", profile.school_id ?? "")
    .order("last_message_at", { ascending: false });
  if (!isManager) query = query.eq("teacher_id", profile.id);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: threads } = await query;

  const studentIds = Array.from(new Set((threads ?? []).map((t) => t.student_id)));
  const parentIds = Array.from(new Set((threads ?? []).map((t) => t.parent_id)));

  const [{ data: students }, { data: parents }] = await Promise.all([
    studentIds.length > 0
      ? supabase.from("students").select("id, full_name").in("id", studentIds)
      : Promise.resolve({ data: [] }),
    parentIds.length > 0
      ? supabase.from("parents").select("id, name").in("id", parentIds)
      : Promise.resolve({ data: [] }),
  ]);
  const studentNameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));
  const parentNameById = new Map((parents ?? []).map((p) => [p.id, p.name]));

  const query_ = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status: statusFilter, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/messages?${qs}` : "/messages";
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Messages</h1>
        <p className="text-sm text-zinc-500">
          {isManager
            ? "Every parent conversation addressed to the office, plus any addressed to a class teacher."
            : "Conversations parents have started with you as a class teacher."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink label="All" href={query_({ status: undefined })} active={!statusFilter} />
        <FilterLink label="Open" href={query_({ status: "open" })} active={statusFilter === "open"} />
        <FilterLink label="Closed" href={query_({ status: "closed" })} active={statusFilter === "closed"} />
      </div>

      <div className="space-y-2">
        {(threads ?? []).map((t) => {
          const unread = !t.staff_last_read_at || t.last_message_at > t.staff_last_read_at;
          return (
            <Link
              key={t.id}
              href={`/messages/${t.id}`}
              className={`block rounded-lg border bg-white p-4 shadow-sm transition hover:border-zinc-400 ${
                unread ? "border-zinc-900" : "border-zinc-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {studentNameById.get(t.student_id) ?? "Student"}
                    {unread && (
                      <span className="ml-2 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        NEW
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {parentNameById.get(t.parent_id) ?? "Parent"} ·{" "}
                    {(t.recipient_kind as ThreadRecipientKind) === "office"
                      ? "To: School office"
                      : "To: Class teacher"}
                  </p>
                </div>
                {(t.status as ThreadStatus) === "closed" && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                    Closed
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        {(threads ?? []).length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
            No messages match this filter.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {label}
    </Link>
  );
}
