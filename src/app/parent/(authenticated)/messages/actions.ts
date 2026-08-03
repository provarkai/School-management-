"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireParent } from "@/lib/current-parent";
import { createClient } from "@/lib/supabase/server";
import type { ThreadRecipientKind } from "@/lib/types";

export interface MessageFormState {
  error?: string;
}

/**
 * Starts a new conversation, or reuses an existing open one about the same
 * child addressed to the same recipient — so asking a follow-up question
 * doesn't fork into a second, disconnected thread.
 */
export async function startThread(
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const { authId, children } = await requireParent();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const recipientKind = String(formData.get("recipient_kind") ?? "") as ThreadRecipientKind;
  const body = String(formData.get("body") ?? "").trim();

  const child = children.find((c) => c.id === studentId);
  if (!child) return { error: "Choose which child this is about." };
  if (recipientKind !== "office" && recipientKind !== "teacher") {
    return { error: "Choose who to message." };
  }
  if (!body) return { error: "Write a message." };

  let teacherId: string | null = null;
  if (recipientKind === "teacher") {
    if (!child.class_id) return { error: "This child has no class assigned yet." };
    const { data: klass } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", child.class_id)
      .single();
    if (!klass?.teacher_id) return { error: "This class has no teacher assigned yet." };
    teacherId = klass.teacher_id;
  }

  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("parent_id", authId)
    .eq("student_id", studentId)
    .eq("recipient_kind", recipientKind)
    .eq("status", "open")
    .maybeSingle();

  let threadId = existing?.id as string | undefined;

  if (!threadId) {
    const { data: thread, error } = await supabase
      .from("message_threads")
      .insert({
        school_id: child.school_id,
        student_id: studentId,
        parent_id: authId,
        recipient_kind: recipientKind,
        teacher_id: teacherId,
      })
      .select("id")
      .single();

    if (error?.code === "23505") {
      // Lost a race with another tab/click — the open thread that was just
      // created under us is exactly the one to reuse.
      const { data: raced } = await supabase
        .from("message_threads")
        .select("id")
        .eq("parent_id", authId)
        .eq("student_id", studentId)
        .eq("recipient_kind", recipientKind)
        .eq("status", "open")
        .single();
      threadId = raced?.id;
    } else if (error || !thread) {
      return { error: error?.message ?? "Could not start the conversation." };
    } else {
      threadId = thread.id;
    }
  }

  if (!threadId) {
    return { error: "Could not start the conversation." };
  }

  const { error: postError } = await supabase.from("message_thread_posts").insert({
    thread_id: threadId,
    sender_kind: "parent",
    sender_parent_id: authId,
    body,
  });

  if (postError) return { error: postError.message };

  redirect(`/parent/messages/${threadId}`);
}

export async function replyToThread(
  threadId: string,
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const { authId } = await requireParent();
  const supabase = await createClient();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a message." };

  const { error } = await supabase.from("message_thread_posts").insert({
    thread_id: threadId,
    sender_kind: "parent",
    sender_parent_id: authId,
    body,
  });

  if (error) return { error: error.message };

  revalidatePath(`/parent/messages/${threadId}`);
  revalidatePath("/parent/messages");
  return {};
}

export async function markThreadReadAsParent(threadId: string): Promise<void> {
  await requireParent();
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read_parent", { target_thread_id: threadId });
}
