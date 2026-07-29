"use client";

import { useActionState } from "react";
import { setStaffSalary, type SalaryFormState } from "./actions";

const initialState: SalaryFormState = {};

export function SalaryForm({ staffId, currentSalary }: { staffId: string; currentSalary: number }) {
  const action = setStaffSalary.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="monthly_salary"
        type="number"
        min={0}
        step="0.01"
        defaultValue={currentSalary || undefined}
        placeholder="0"
        className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
