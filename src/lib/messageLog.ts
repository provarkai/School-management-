import type { createClient } from "@/lib/supabase/server";
import { sendReminderMessage, type SendResult } from "@/lib/termii";
import type { MessagePurpose } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface MessageContext {
  schoolId: string;
  purpose: MessagePurpose;
  recipientName?: string | null;
  studentId?: string | null;
  staffId?: string | null;
  sentBy?: string | null;
}

/**
 * Sends a message through Termii and records the attempt, so "sent to N
 * recipients" (the only thing any send flow could previously report)
 * becomes a list a school can actually read back — who, when, and whether
 * it failed.
 *
 * A logging failure never masks a real send outcome: if the insert itself
 * errors, the SendResult from the actual send is still returned unchanged.
 */
export async function sendAndLogMessage(
  supabase: SupabaseClient,
  context: MessageContext,
  phone: string,
  message: string
): Promise<SendResult> {
  const result = await sendReminderMessage(phone, message);

  await supabase.from("message_logs").insert({
    school_id: context.schoolId,
    purpose: context.purpose,
    recipient_phone: phone,
    recipient_name: context.recipientName ?? null,
    student_id: context.studentId ?? null,
    staff_id: context.staffId ?? null,
    message,
    status: result.ok ? (result.mocked ? "mocked" : "sent") : "failed",
    error: result.error ?? null,
    sent_by: context.sentBy ?? null,
  });

  return result;
}
