import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";
import { markThreadReadAsParent } from "../actions";
import { ReplyForm } from "./ReplyForm";

export default async function ParentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const { authId, children } = await requireParent();
  const supabase = await createClient();

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, student_id, recipient_kind, teacher_id, status, parent_id")
    .eq("id", threadId)
    .single();

  if (!thread || thread.parent_id !== authId) notFound();

  await markThreadReadAsParent(threadId);

  const student = children.find((c) => c.id === thread.student_id);

  const [{ data: posts }, { data: teacher }] = await Promise.all([
    supabase
      .from("message_thread_posts")
      .select("id, sender_kind, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true }),
    thread.teacher_id
      ? supabase.from("app_users").select("name").eq("id", thread.teacher_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/parent/messages" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← All messages
      </Link>

      <div>
        <h1 className="text-xl font-bold text-zinc-900">{student?.full_name ?? "Student"}</h1>
        <p className="text-sm text-zinc-500">
          {thread.recipient_kind === "office" ? "School office" : teacher?.name ?? "Class teacher"}
          {thread.status === "closed" && (
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              Closed
            </span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {(posts ?? []).map((p) => (
          <div
            key={p.id}
            className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
              p.sender_kind === "parent"
                ? "ml-auto bg-zinc-900 text-white"
                : "bg-white text-zinc-900"
            }`}
          >
            <p className="whitespace-pre-wrap">{p.body}</p>
            <p className={`mt-1 text-xs ${p.sender_kind === "parent" ? "text-zinc-400" : "text-zinc-400"}`}>
              {new Date(p.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <ReplyForm threadId={threadId} />
    </div>
  );
}
