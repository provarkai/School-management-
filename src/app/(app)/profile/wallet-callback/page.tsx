import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";
import { markWalletTopupSuccess } from "@/lib/messageWallet";
import { naira } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Redirect target after a message-wallet top-up checkout — the
 * authenticated-Settings equivalent of /pay/callback. Verifies the charge
 * synchronously as a fast-path; the webhook is still the authoritative
 * confirmation if this never runs (the proprietor closes their browser
 * before the redirect completes).
 */
export default async function WalletCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  await requireProprietor();
  const { reference } = await searchParams;

  if (!reference) {
    return (
      <Result title="Missing payment reference" ok={false}>
        We couldn&apos;t confirm this top-up — no reference was provided.
      </Result>
    );
  }

  const verified = await verifyTransaction(reference);

  if (!verified.ok || !verified.success) {
    return (
      <Result title="Payment not confirmed" ok={false}>
        {verified.error ?? "This payment could not be verified. If you were charged, contact support with your reference."}
        <p className="mt-2 font-mono text-xs text-zinc-400">{reference}</p>
      </Result>
    );
  }

  const admin = createAdminClient();
  const result = await markWalletTopupSuccess(admin, reference, verified.amountNaira);

  if (!result.ok) {
    return (
      <Result title="Payment verified, but we hit a snag recording it" ok={false}>
        {result.error} Contact support with your reference — we can confirm and credit it manually.
        <p className="mt-2 font-mono text-xs text-zinc-400">{reference}</p>
      </Result>
    );
  }

  return (
    <Result title="Top-up successful" ok={true}>
      {verified.amountNaira !== undefined && (
        <p className="font-semibold text-zinc-900">{naira(verified.amountNaira)} added to your message wallet.</p>
      )}
    </Result>
  );
}

function Result({ title, ok, children }: { title: string; ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        className={`w-full max-w-sm rounded-lg border p-6 text-center shadow-sm ${
          ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
        }`}
      >
        <h1 className={`text-lg font-bold ${ok ? "text-emerald-800" : "text-red-800"}`}>{title}</h1>
        <div className={`mt-2 text-sm ${ok ? "text-emerald-700" : "text-red-700"}`}>{children}</div>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Back to Settings
        </Link>
      </div>
    </div>
  );
}
