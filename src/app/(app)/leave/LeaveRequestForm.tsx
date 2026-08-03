"use client";

import { useActionState } from "react";
import { fileLeaveRequest, type LeaveFormState } from "./actions";
import { LEAVE_TYPE_LABELS, type LeaveType } from "@/lib/types";

const initialState: LeaveFormState = {};

export function LeaveRequestForm() {
  const [state, action, pending] = useActionState(fileLeaveRequest, initialState);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Request leave</h2>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <label className="text-sm font-medium text-zinc-700">
          Type
          <select
            name="leave_type"
            defaultValue="annual"
            className="mt-1 block w-44 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Start date
          <input
            name="start_date"
            type="date"
            required
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          End date
          <input
            name="end_date"
            type="date"
            required
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
      </div>
      <label className="block text-sm font-medium text-zinc-700">
        Reason (optional)
        <textarea
          name="reason"
          rows={2}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Filing…" : "Submit request"}
      </button>
    </form>
  );
}
