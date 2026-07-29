"use client";

import { useState, useTransition } from "react";
import { ignoreTransferAlert, matchTransferAlert } from "./actions";

export function MatchButton({
  alertId,
  studentId,
  feeTypes,
}: {
  alertId: string;
  studentId: string;
  feeTypes: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [feeTypeId, setFeeTypeId] = useState(feeTypes[0]?.id ?? "");

  return (
    <div className="flex items-center gap-2">
      {feeTypes.length > 1 && (
        <select
          value={feeTypeId}
          onChange={(e) => setFeeTypeId(e.target.value)}
          className="rounded-md border border-zinc-300 px-1.5 py-1 text-xs"
        >
          {feeTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={pending || !feeTypeId}
        onClick={() => startTransition(() => matchTransferAlert(alertId, studentId, feeTypeId))}
        className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Matching…" : "Match & record payment"}
      </button>
    </div>
  );
}

export function IgnoreButton({ alertId }: { alertId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => ignoreTransferAlert(alertId))}
      className="text-xs font-medium text-zinc-400 hover:text-zinc-600"
    >
      {pending ? "…" : "Ignore"}
    </button>
  );
}
