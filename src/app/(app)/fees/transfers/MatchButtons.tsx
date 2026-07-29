"use client";

import { useTransition } from "react";
import { ignoreTransferAlert, matchTransferAlert } from "./actions";

export function MatchButton({ alertId, studentId }: { alertId: string; studentId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => matchTransferAlert(alertId, studentId))}
      className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
    >
      {pending ? "Matching…" : "Match & record payment"}
    </button>
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
