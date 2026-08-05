import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendReminderMessage, isMockMode, type SendResult } from "@/lib/sms";
import { MESSAGE_COST_KOBO } from "@/lib/messageWallet";
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

const INSUFFICIENT_BALANCE_MESSAGE =
  "This school's message wallet balance is too low to send — top up in Settings to keep sending.";

function maskPhone(phone: string): string {
  return phone.length > 4 ? `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : phone;
}

/**
 * Sends a message through SMSLive247 and records the attempt, so "sent to N
 * recipients" (the only thing any send flow could previously report)
 * becomes a list a school can actually read back — who, when, and whether
 * it failed.
 *
 * Every send now costs the school MESSAGE_COST_KOBO from its message
 * wallet, checked and debited atomically (debit_message_wallet, 0082)
 * *before* the provider is called, so a school can never send past a zero
 * balance — the send is refused outright and logged as 'blocked' instead.
 * If the provider then fails after the debit went through, the debit is
 * refunded (an 'adjustment' credit) — a school is only ever actually
 * charged for a message that went out.
 *
 * The wallet check always runs through the service-role admin client, not
 * whichever client the caller passed in for logging — debit_message_wallet
 * is deliberately not grantable to a normal user session (see 0082), and
 * this function is called from contexts with very different sessions (a
 * staff member's own request, the weekly cron job with no user session at
 * all), so it can't rely on RLS/auth.uid() to resolve which school to debit.
 *
 * Mock mode (no SMSLIVE247_API_KEY) is exempt from all of this — no real
 * cost is being incurred, so nothing is billed, exactly like Paystack's own
 * mock mode not touching real money.
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
  const billable = !isMockMode();
  const admin = billable ? createAdminClient() : null;

  if (admin) {
    const { data: newBalance, error: debitError } = await admin.rpc("debit_message_wallet", {
      target_school_id: context.schoolId,
      debit_kobo: MESSAGE_COST_KOBO,
      debit_description: `SMS to ${maskPhone(phone)} (${context.purpose})`,
    });

    if (debitError || newBalance === null) {
      await supabase.from("message_logs").insert({
        school_id: context.schoolId,
        purpose: context.purpose,
        recipient_phone: phone,
        recipient_name: context.recipientName ?? null,
        student_id: context.studentId ?? null,
        staff_id: context.staffId ?? null,
        message,
        status: "blocked",
        error: debitError?.message ?? INSUFFICIENT_BALANCE_MESSAGE,
        sent_by: context.sentBy ?? null,
      });

      return { phone, ok: false, mocked: false, error: INSUFFICIENT_BALANCE_MESSAGE };
    }
  }

  const result = await sendReminderMessage(phone, message);

  if (admin && !result.ok) {
    // The wallet was already debited above; refund it since nothing was
    // actually delivered (or even attempted, from the provider's side).
    await admin.rpc("credit_message_wallet", {
      target_school_id: context.schoolId,
      credit_kobo: MESSAGE_COST_KOBO,
      credit_type: "adjustment",
      credit_description: `Refund: send to ${maskPhone(phone)} failed`,
    });
  }

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
