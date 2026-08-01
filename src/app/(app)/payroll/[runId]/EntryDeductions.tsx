"use client";

import { useActionState } from "react";
import { naira } from "@/lib/format";
import { addPayrollDeduction, removePayrollDeduction, type DeductionFormState } from "../actions";

const initialState: DeductionFormState = {};

export function EntryDeductions({
  entryId,
  runId,
  editable,
  lineItems,
  deductionTypes,
}: {
  entryId: string;
  runId: string;
  editable: boolean;
  lineItems: { id: string; amount: number; typeName: string }[];
  deductionTypes: { id: string; name: string }[];
}) {
  const action = addPayrollDeduction.bind(null, entryId, runId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (lineItems.length === 0 && !editable) {
    return null;
  }

  return (
    <div className="space-y-2">
      {lineItems.length > 0 && (
        <ul className="space-y-1">
          {lineItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {item.typeName} — {naira(item.amount)}
              </span>
              {editable && (
                <form action={removePayrollDeduction.bind(null, item.id, entryId, runId)}>
                  <button type="submit" className="font-medium text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <select
            name="deduction_type_id"
            required
            defaultValue=""
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="" disabled>
              Deduction type…
            </option>
            {deductionTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            required
            className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add"}
          </button>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      )}
    </div>
  );
}
