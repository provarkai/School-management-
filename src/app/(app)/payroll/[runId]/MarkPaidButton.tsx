"use client";

import { markPayrollRunPaid } from "../actions";

export function MarkPaidButton({ runId }: { runId: string }) {
  return (
    <form action={markPayrollRunPaid.bind(null, runId)}>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
      >
        Mark payroll as paid
      </button>
    </form>
  );
}
