"use client";

import { deleteExpense } from "./actions";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  return (
    <form action={deleteExpense.bind(null, expenseId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
