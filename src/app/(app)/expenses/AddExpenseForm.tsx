"use client";

import { useActionState } from "react";
import { createExpense, type ExpenseFormState } from "./actions";

const initialState: ExpenseFormState = {};

export function AddExpenseForm({
  categories,
  campuses,
}: {
  categories: { id: string; name: string }[];
  campuses: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createExpense, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">Record an expense</h2>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <form
        action={action}
        className={`grid grid-cols-1 gap-3 sm:items-end ${
          campuses.length > 0 ? "sm:grid-cols-6" : "sm:grid-cols-5"
        }`}
      >
        <label className="text-sm font-medium text-zinc-700">
          Category
          <select
            name="category_id"
            required
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Amount
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input
            name="expense_date"
            type="date"
            defaultValue={today}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Vendor (optional)
          <input
            name="vendor"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        {campuses.length > 0 && (
          <label className="text-sm font-medium text-zinc-700">
            Campus
            <select
              name="campus_id"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">All / N/A</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium text-zinc-700">
          Note (optional)
          <input
            name="description"
            placeholder="What was this for?"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className={`rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:w-fit ${
            campuses.length > 0 ? "sm:col-span-6" : "sm:col-span-5"
          }`}
        >
          {pending ? "Saving…" : "Record expense"}
        </button>
      </form>
    </section>
  );
}
