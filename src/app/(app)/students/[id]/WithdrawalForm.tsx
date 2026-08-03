"use client";

import { useActionState } from "react";
import { withdrawStudent, type WithdrawalState } from "../actions";

const initialState: WithdrawalState = {};

export interface WithdrawalRecord {
  status: string;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  conduct_remark: string | null;
}

export function WithdrawalSection({
  studentId,
  record,
}: {
  studentId: string;
  record: WithdrawalRecord;
}) {
  // Hooks must run on every render regardless of which branch below is
  // shown, so this is called unconditionally even though the withdrawn
  // branch never uses it.
  const [state, action, pending] = useActionState(withdrawStudent.bind(null, studentId), initialState);

  if (record.status === "withdrawn") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm">
        <h3 className="mb-2 font-semibold text-amber-900">Withdrawn</h3>
        <dl className="grid grid-cols-2 gap-2 text-amber-800">
          <dt className="text-amber-600">Date left</dt>
          <dd>{record.withdrawn_at ?? "—"}</dd>
          {record.withdrawal_reason && (
            <>
              <dt className="text-amber-600">Reason</dt>
              <dd>{record.withdrawal_reason}</dd>
            </>
          )}
        </dl>
        <a
          href={`/students/${studentId}/transfer-certificate`}
          className="mt-4 inline-block rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 shadow-sm hover:bg-amber-100"
        >
          Download transfer certificate →
        </a>
      </section>
    );
  }

  if (record.status !== "active") {
    return null;
  }

  return (
    <details className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-zinc-900">
        Withdraw student / issue transfer certificate
      </summary>
      <form action={action} className="space-y-4 border-t border-zinc-100 px-5 py-4">
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
        <p className="text-sm text-zinc-500">
          This moves the student out of the active roster and enables a transfer certificate.
          There is no self-service undo — if this is a mistake, contact support.
        </p>
        <label className="block max-w-xs text-sm font-medium text-zinc-700">
          Date left
          <input
            name="withdrawn_at"
            type="date"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Reason for leaving (shown on the certificate if given)
          <input
            name="withdrawal_reason"
            placeholder="e.g. Relocation, transfer to another school"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Conduct and character remark
          <textarea
            name="conduct_remark"
            rows={2}
            placeholder="Defaults to “Satisfactory.” if left blank"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          onClick={(e) => {
            if (!confirm("This moves the student out of the active roster. Continue?")) {
              e.preventDefault();
            }
          }}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Withdraw student"}
        </button>
      </form>
    </details>
  );
}
