"use client";

import { useState, useTransition } from "react";
import { initiateWalletTopup } from "./actions";
import { TOPUP_PACKS_NAIRA } from "@/lib/messageWallet";
import { naira } from "@/lib/format";

export interface WalletTransactionRow {
  id: string;
  amount_kobo: number;
  type: "topup" | "debit" | "adjustment";
  description: string | null;
  created_at: string;
}

const TYPE_STYLES: Record<WalletTransactionRow["type"], string> = {
  topup: "text-emerald-600",
  debit: "text-zinc-500",
  adjustment: "text-amber-600",
};

export function MessageWalletSection({
  balanceNaira,
  recentTransactions,
  smsConfigured,
}: {
  balanceNaira: number;
  recentTransactions: WalletTransactionRow[];
  /** False while SMSLIVE247_API_KEY is unset — sends are free (mock mode)
   * and the wallet is never touched, so top-ups would just sit unused. */
  smsConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function topUp(amountNaira: number) {
    setError(null);
    setLoadingAmount(amountNaira);
    startTransition(async () => {
      const result = await initiateWalletTopup(amountNaira);
      if (result.error) {
        setError(result.error);
        setLoadingAmount(null);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    });
  }

  return (
    <div className="space-y-4">
      {!smsConfigured && (
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          SMS sending is currently in mock mode — messages are free and this wallet isn&rsquo;t
          charged. Topping up still works, so you can test the flow before going live.
        </p>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Balance</p>
        <p className="mt-1 text-2xl font-bold text-zinc-900">{naira(balanceNaira)}</p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500">Top up</p>
        <div className="flex flex-wrap gap-2">
          {TOPUP_PACKS_NAIRA.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => topUp(amount)}
              disabled={pending}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              {pending && loadingAmount === amount ? "Redirecting…" : naira(amount)}
            </button>
          ))}
        </div>
      </div>

      {recentTransactions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500">Recent activity</p>
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100">
            {recentTransactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="truncate text-zinc-600">
                  {t.description ?? t.type}
                  <span className="ml-2 text-zinc-400">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </span>
                <span className={`shrink-0 font-medium ${TYPE_STYLES[t.type]}`}>
                  {t.amount_kobo > 0 ? "+" : ""}
                  {naira(t.amount_kobo / 100)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
