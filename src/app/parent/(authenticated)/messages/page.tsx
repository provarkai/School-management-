import Link from "next/link";
import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";
import { NewThreadForm, type MessageableChild } from "./NewThreadForm";

export default async function ParentMessagesPage() {
  const { authId, children } = await requireParent();
  const supabase = await createClient();

  const classIds = children.map((c) => c.class_id).filter((id): id is string => !!id);
  const { data: classes } =
    classIds.length > 0
      ? await supabase.from("classes").select("id, teacher_id").in("id", classIds)
      : { data: [] };
  const teacherIdByClass = new Map((classes ?? []).map((c) => [c.id, c.teacher_id]));

  const messageableChildren: MessageableChild[] = children.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    className: c.className,
    hasTeacher: !!c.class_id && !!teacherIdByClass.get(c.class_id),
  }));

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, student_id, recipient_kind, teacher_id, status, last_message_at, parent_last_read_at")
    .eq("parent_id", authId)
    .order("last_message_at", { ascending: false });

  const teacherIds = Array.from(
    new Set((threads ?? []).map((t) => t.teacher_id).filter((id): id is string => !!id))
  );
  const { data: teachers } =
    teacherIds.length > 0
      ? await supabase.from("app_users").select("id, name").in("id", teacherIds)
      : { data: [] };
  const teacherNameById = new Map((teachers ?? []).map((t) => [t.id, t.name]));
  const studentNameById = new Map(children.map((c) => [c.id, c.full_name]));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Messages</h1>
        <p className="text-sm text-zinc-500">
          Message the school office or your child&rsquo;s class teacher directly.
        </p>
      </div>

      {messageableChildren.length > 0 && <NewThreadForm students={messageableChildren} />}

      <div className="space-y-2">
        {(threads ?? []).map((t) => {
          const unread = !t.parent_last_read_at || t.last_message_at > t.parent_last_read_at;
          return (
            <Link
              key={t.id}
              href={`/parent/messages/${t.id}`}
              className={`block rounded-lg border bg-white p-4 shadow-sm transition hover:border-zinc-400 ${
                unread ? "border-zinc-900" : "border-zinc-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
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
                    {t.recipient_kind === "office"
                      ? "School office"
                      : teacherNameById.get(t.teacher_id ?? "") ?? "Class teacher"}
                  </p>
                </div>
                {t.status === "closed" && (
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
            No messages yet.
          </p>
        )}
      </div>
    </div>
  );
}
