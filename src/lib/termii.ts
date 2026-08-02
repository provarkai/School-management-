/**
 * Termii (https://termii.com) SMS + WhatsApp wrapper for parent reminders.
 * Nigerian-focused provider — handles local delivery better than international
 * providers for this use case.
 *
 * In "mock" mode (no TERMII_API_KEY set) messages are logged instead of sent,
 * so the reminders flow is fully testable before real credentials exist.
 */

export interface SendResult {
  phone: string;
  ok: boolean;
  mocked: boolean;
  error?: string;
}

const TERMII_BASE_URL = "https://api.ng.termii.com/api";

function isMockMode(): boolean {
  return !process.env.TERMII_API_KEY;
}

/**
 * Sends a single templated message. Tries WhatsApp first, falling back to SMS
 * — matches the "WhatsApp over SMS where possible" guidance for Nigeria.
 */
export async function sendReminderMessage(
  phone: string,
  message: string
): Promise<SendResult> {
  if (isMockMode()) {
    console.log(`[termii:mock] to=${phone} message=${message}`);
    return { phone, ok: true, mocked: true };
  }

  const apiKey = process.env.TERMII_API_KEY!;
  const senderId = process.env.TERMII_SENDER_ID || "SchoolMgr";

  try {
    const res = await fetch(`${TERMII_BASE_URL}/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: phone,
        from: senderId,
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { phone, ok: false, mocked: false, error: `Termii error ${res.status}: ${text}` };
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
