"use client";

import { useState, useTransition } from "react";
import { resolveSettlementAccount, activateOnlinePayments } from "./actions";

export interface BankOption {
  name: string;
  code: string;
}

export interface SettlementInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export function OnlinePaymentsSection({
  banks,
  banksMocked,
  settlement,
}: {
  banks: BankOption[];
  banksMocked: boolean;
  /** Null when the school hasn't activated online payments yet. */
  settlement: SettlementInfo | null;
}) {
  const [editing, setEditing] = useState(!settlement);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verifying, startVerifying] = useTransition();
  const [activating, startActivating] = useTransition();

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";

  function verify() {
    setError(null);
    setResolvedName(null);
    startVerifying(async () => {
      const result = await resolveSettlementAccount(bankCode, accountNumber);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResolvedName(result.accountName ?? null);
    });
  }

  function activate() {
    setError(null);
    setSuccess(null);
    startActivating(async () => {
      const result = await activateOnlinePayments(bankCode, bankName, accountNumber, resolvedName ?? "");
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Activated.");
      setEditing(false);
    });
  }

  if (settlement && !editing) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✅ Online payments are active. Parents&rsquo; card payments settle directly to{" "}
          <strong>{settlement.bankName}</strong> ••••{settlement.accountNumber.slice(-4)} (
          {settlement.accountName}).
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          Change settlement account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!settlement && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Not set up yet — parents can&rsquo;t pay fees online until a settlement account is added.
          Cash and bank transfer payments are unaffected.
        </p>
      )}
      {banksMocked && (
        <p className="text-xs text-zinc-400">Mock mode — bank list and verification are simulated.</p>
      )}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          Bank
          <select
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value);
              setResolvedName(null);
            }}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          >
            <option value="">Select a bank…</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Account number
          <input
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
              setResolvedName(null);
            }}
            inputMode="numeric"
            placeholder="0123456789"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
          />
        </label>
      </div>

      {resolvedName ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-sm text-emerald-800">
            Verified: <strong>{resolvedName}</strong>
          </p>
          <button
            type="button"
            onClick={activate}
            disabled={activating}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {activating ? "Activating…" : "Activate online payments"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={verify}
          disabled={verifying || !bankCode || accountNumber.length !== 10}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify account"}
        </button>
      )}

      {settlement && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="block text-xs font-medium text-zinc-400 hover:text-zinc-700"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
