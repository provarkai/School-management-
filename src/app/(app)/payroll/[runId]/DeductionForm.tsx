"use client";

import { useActionState } from "react";
import { setPayrollEntryDeduction, type DeductionFormState } from "../actions";

const initialState: DeductionFormState = {};

export function DeductionForm({
  entryId,
  runId,
  currentDeductions,
  currentReason,
}: {
  entryId: string;
  runId: string;
  currentDeductions: number;
  currentReason: string | null;
}) {
  const action = setPayrollEntryDeduction.bind(null, entryId, runId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="deductions"
        type="number"
        min={0}
        step="0.01"
        defaultValue={currentDeductions || undefined}
        placeholder="0"
        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      <input
        name="deduction_reason"
        defaultValue={currentReason ?? ""}
        placeholder="Reason (optional)"
        className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
