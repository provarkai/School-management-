import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";
import { markPaymentIntentSuccess } from "@/lib/payments";
import { naira } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Public redirect target after a Paystack checkout — no login required,
 * since the person paying (a parent clicking a link from an SMS) may not
 * have a portal account. Verifies the charge synchronously as a fast-path;
 * the webhook is still the authoritative confirmation if this never runs
 * (e.g. the payer closes their browser before the redirect completes).
 */
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; student?: string }>;
}) {
  const { reference, student: studentId } = await searchParams;

  if (!reference) {
    return (
      <Result title="Missing payment reference" ok={false}>
        We couldn&apos;t confirm this payment — no reference was provided.
      </Result>
    );
  }

  const verified = await verifyTransaction(reference);

  if (!verified.ok || !verified.success) {
    return (
      <Result title="Payment not confirmed" ok={false}>
        {verified.error ?? "This payment could not be verified. If you were charged, contact the school office with your reference."}
        <p className="mt-2 font-mono text-xs text-zinc-400">{reference}</p>
      </Result>
    );
  }

  const admin = createAdminClient();
  const result = await markPaymentIntentSuccess(admin, reference, verified.amountNaira);

  if (!result.ok) {
    return (
      <Result title="Payment verified, but we hit a snag recording it" ok={false}>
        {result.error} Contact the school office with your reference — they can confirm and
        record it manually.
        <p className="mt-2 font-mono text-xs text-zinc-400">{reference}</p>
      </Result>
    );
  }

  return (
    <Result title="Payment successful" ok={true}>
      {verified.amountNaira !== undefined && (
        <p className="font-semibold text-zinc-900">{naira(verified.amountNaira)} received.</p>
      )}
      <p className="mt-1">Thank you — the school&apos;s records have been updated.</p>
      {studentId && (
        <Link
          href={`/parent/${studentId}`}
          className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Back to student
        </Link>
      )}
    </Result>
  );
}

function Result({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        className={`w-full max-w-sm rounded-lg border p-6 text-center shadow-sm ${
          ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
        }`}
      >
        <h1 className={`text-lg font-bold ${ok ? "text-emerald-800" : "text-red-800"}`}>
          {title}
        </h1>
        <div className={`mt-2 text-sm ${ok ? "text-emerald-700" : "text-red-700"}`}>{children}</div>
      </div>
    </div>
  );
}
