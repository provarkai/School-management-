import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { ThreadRecipientKind, ThreadStatus } from "@/lib/types";
import { markThreadReadAsStaff } from "../actions";
import { StaffReplyForm } from "./StaffReplyForm";
import { ThreadStatusButton } from "./ThreadStatusButton";

export default async function StaffThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, student_id, parent_id, recipient_kind, status")
    .eq("id", threadId)
    .eq("school_id", profile.school_id ?? "")
    .maybeSingle();

  if (!thread) notFound();

  await markThreadReadAsStaff(threadId);

  const [{ data: student }, { data: parent }, { data: posts }] = await Promise.all([
    supabase.from("students").select("full_name, class_id").eq("id", thread.student_id).single(),
    supabase.from("parents").select("name, phone").eq("id", thread.parent_id).single(),
    supabase
      .from("message_thread_posts")
      .select("id, sender_kind, sender_staff_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true }),
  ]);

  const staffIds = Array.from(
    new Set((posts ?? []).map((p) => p.sender_staff_id).filter((id): id is string => !!id))
  );
  const { data: staff } =
    staffIds.length > 0
      ? await supabase.from("app_users").select("id, name").in("id", staffIds)
      : { data: [] };
  const staffNameById = new Map((staff ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/messages" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← All messages
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">
            <Link href={`/students/${thread.student_id}`} className="hover:underline">
              {student?.full_name ?? "Student"}
            </Link>
          </h1>
          <p className="text-sm text-zinc-500">
            {parent?.name ?? "Parent"}
            {parent?.phone ? ` · ${parent.phone}` : ""} ·{" "}
            {(thread.recipient_kind as ThreadRecipientKind) === "office"
              ? "School office"
              : "Class teacher"}
          </p>
        </div>
        <ThreadStatusButton threadId={threadId} status={thread.status as ThreadStatus} />
      </div>

      <div className="space-y-3">
        {(posts ?? []).map((p) => (
          <div
            key={p.id}
            className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
              p.sender_kind === "staff" ? "ml-auto bg-zinc-900 text-white" : "bg-white text-zinc-900"
            }`}
          >
            {p.sender_kind === "staff" && p.sender_staff_id && (
              <p className="mb-1 text-xs font-semibold text-zinc-300">
                {staffNameById.get(p.sender_staff_id) ?? "Staff"}
              </p>
            )}
            <p className="whitespace-pre-wrap">{p.body}</p>
            <p className="mt-1 text-xs text-zinc-400">{new Date(p.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <StaffReplyForm threadId={threadId} />
    </div>
  );
}
