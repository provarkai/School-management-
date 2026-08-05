/**
 * SMSLive247 (https://smslive247api.readme.io) wrapper for parent reminders
 * and staff broadcasts. SMSLive247 has no WhatsApp product — every send
 * here goes out as plain SMS, despite callers/UI copy elsewhere in the app
 * still saying "SMS/WhatsApp" (a holdover from the previous provider,
 * Termii, which did route some sends over WhatsApp).
 *
 * In "mock" mode (no SMSLIVE247_API_KEY set) messages are logged instead of
 * sent, so the reminders flow is fully testable before real credentials
 * exist — same pattern as src/lib/paystack.ts.
 */

export interface SendResult {
  phone: string;
  ok: boolean;
  mocked: boolean;
  error?: string;
}

const SMSLIVE247_BASE_URL = "https://api.smslive247.com/api/v4";

export function isMockMode(): boolean {
  return !process.env.SMSLIVE247_API_KEY;
}

interface Smslive247ErrorBody {
  code?: number;
  message?: string;
  errors?: { field: string; message: string }[];
}

export async function sendReminderMessage(
  phone: string,
  message: string
): Promise<SendResult> {
  if (isMockMode()) {
    console.log(`[smslive247:mock] to=${phone} message=${message}`);
    return { phone, ok: true, mocked: true };
  }

  const apiKey = process.env.SMSLIVE247_API_KEY!;
  const senderId = process.env.SMSLIVE247_SENDER_ID || "SchoolMgr";

  try {
    const res = await fetch(`${SMSLIVE247_BASE_URL}/sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        senderID: senderId,
        messageText: message,
        mobileNumber: phone,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as Smslive247ErrorBody | null;
      const detail = body?.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
      const errorMessage = detail || body?.message || `SMSLive247 error ${res.status}`;
      return { phone, ok: false, mocked: false, error: errorMessage };
    }

    return { phone, ok: true, mocked: false };
  } catch (err) {
    return {
      phone,
      ok: false,
      mocked: false,
      error: err instanceof Error ? err.message : "Unknown error sending message",
    };
  }
}

export function feeReminderTemplate(params: {
  parentName: string;
  studentName: string;
  balance: string;
  termLabel: string;
  schoolName: string;
}): string {
  const { parentName, studentName, balance, termLabel, schoolName } = params;
  return `Dear ${parentName}, this is a reminder that ${studentName}'s school fees balance of ${balance} for ${termLabel} is outstanding. Kindly make payment at your earliest convenience. — ${schoolName}`;
}
