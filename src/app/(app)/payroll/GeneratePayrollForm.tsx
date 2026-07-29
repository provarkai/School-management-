"use client";

import { useActionState } from "react";
import { generatePayrollRun, type PayrollRunFormState } from "./actions";

const initialState: PayrollRunFormState = {};

export function GeneratePayrollForm() {
  const [state, formAction, pending] = useActionState(generatePayrollRun, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-zinc-700">
        Month
        <input
          name="period"
          type="month"
          required
          defaultValue={new Date().toISOString().slice(0, 7)}
          className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate / open payroll run"}
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
