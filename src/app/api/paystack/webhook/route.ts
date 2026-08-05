import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { markPaymentIntentSuccess } from "@/lib/payments";
import { markWalletTopupSuccess } from "@/lib/messageWallet";

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

    // Paystack reports amounts in kobo; the signature above is what makes
    // this figure trustworthy enough to credit against a fee record.
    const koboAmount = Number(event.data?.amount);
    const settledAmountNaira = Number.isFinite(koboAmount) && koboAmount > 0 ? koboAmount / 100 : undefined;

    const admin = createAdminClient();

    // Two different kinds of checkout share this one webhook — routed by
    // reference prefix (generateReference()'s first argument) rather than a
    // lookup-and-fall-through, so a stray reference from neither table just
    // falls out the bottom instead of triggering two failed lookups.
    const result = reference.startsWith("msgwallet_")
      ? await markWalletTopupSuccess(admin, reference, settledAmountNaira)
      : await markPaymentIntentSuccess(admin, reference, settledAmountNaira);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
