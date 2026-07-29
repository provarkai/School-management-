import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { markPaymentIntentSuccess } from "@/lib/payments";

/**
 * Paystack webhook — the authoritative source of truth for a successful
 * charge (the redirect-back callback is best-effort only, since a parent can
 * close their browser before it fires). Configure this URL as the webhook
 * endpoint in the Paystack dashboard once PAYSTACK_SECRET_KEY is set.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const reference = event.data?.reference;
    if (!reference) {
      return Response.json({ error: "Missing reference" }, { status: 400 });
    }

    const admin = createAdminClient();
    const result = await markPaymentIntentSuccess(admin, reference);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
