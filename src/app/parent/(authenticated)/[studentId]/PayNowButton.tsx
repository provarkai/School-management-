"use client";

import { useActionState } from "react";
import { payFees, type PayFeesState } from "./actions";

const initialState: PayFeesState = {};

export function PayNowButton({
  studentId,
  feeTypeId,
  label,
}: {
  studentId: string;
  feeTypeId: string;
  label: string;
}) {
  const action = payFees.bind(null, studentId, feeTypeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      {state.error && (
        <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Starting payment…" : label}
      </button>
    </form>
  );
}
