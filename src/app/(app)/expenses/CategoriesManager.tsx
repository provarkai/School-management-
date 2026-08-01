"use client";

import { useActionState, useState } from "react";
import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategoryBudget,
  type CategoryFormState,
} from "./actions";

const initialState: CategoryFormState = {};

export function CategoriesManager({
  categories,
}: {
  categories: { id: string; name: string; termly_budget: number | null }[];
}) {
  const [state, action, pending] = useActionState(createExpenseCategory, initialState);
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Expense categories</h2>
          <p className="text-xs text-zinc-400">
            {categories.map((c) => c.name).join(", ") || "None yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          {expanded ? "Hide" : "Manage"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          {categories.length > 0 && (
            <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100">
              {categories.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-zinc-900">{c.name}</span>
                  <div className="flex items-center gap-3">
                    <form
                      action={(formData) => updateExpenseCategoryBudget(c.id, formData)}
                      className="flex items-center gap-1.5"
                    >
                      <span className="text-xs text-zinc-400">Termly budget</span>
                      <input
                        name="termly_budget"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={c.termly_budget ?? ""}
                        placeholder="Optional"
                        className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-xs shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                      <button
                        type="submit"
                        className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                      >
                        Save
                      </button>
                    </form>
                    <form action={deleteExpenseCategory.bind(null, c.id)}>
                      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          <form action={action} className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-zinc-700">
              Add a category
              <input
                name="name"
                required
                placeholder="e.g. Rent, Utilities, Supplies"
                className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:w-56"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Termly budget (optional)
              <input
                name="termly_budget"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 50000"
                className="mt-1 block w-36 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
