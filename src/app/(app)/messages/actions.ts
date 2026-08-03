"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import type { ThreadStatus } from "@/lib/types";

export interface MessageFormState {
  error?: string;
}

export async function replyToThreadAsStaff(
  threadId: string,
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a message." };

  const { error } = await supabase.from("message_thread_posts").insert({
    thread_id: threadId,
    sender_kind: "staff",
    sender_staff_id: profile.id,
    body,
  });

  if (error) return { error: error.message };

  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
  return {};
}

export async function markThreadReadAsStaff(threadId: string): Promise<void> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  await supabase
    .from("message_threads")
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("school_id", profile.school_id ?? "");
}

export async function setThreadStatus(threadId: string, status: ThreadStatus): Promise<void> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("message_threads")
    .update({ status })
    .eq("id", threadId)
    .eq("school_id", profile.school_id ?? "");

  if (error) throw new Error(error.message);
  revalidatePath(`/messages/${threadId}`);
  revalidatePath("/messages");
}
