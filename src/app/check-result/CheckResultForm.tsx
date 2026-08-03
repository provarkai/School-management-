"use client";

import { useActionState } from "react";
import { checkResult, type CheckResultState } from "./actions";

const initialState: CheckResultState = {};

export function CheckResultForm() {
  const [state, action, pending] = useActionState(checkResult, initialState);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <label className="block text-sm font-medium text-zinc-700">
          Serial number
          <input
            name="serial"
            placeholder="AB12-CD34-EF56"
            required
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          PIN
          <input
            name="pin"
            placeholder="10-digit PIN"
            required
            autoComplete="off"
            inputMode="numeric"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Student&rsquo;s admission number
          <input
            name="admission_number"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Check result"}
        </button>
      </form>

      {state.result && (
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {state.result.schoolName}
            </p>
            <h2 className="mt-1 text-xl font-bold text-zinc-900">{state.result.studentName}</h2>
            <p className="text-sm text-zinc-500">
              {state.result.className} · {state.result.sessionLabel}
            </p>
          </div>

          {state.result.withheld ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Results are held pending payment of an outstanding balance. Please contact the
              school office.
            </p>
          ) : state.result.rows.length === 0 ? (
            <p className="text-center text-sm text-zinc-400">No scores entered yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                  <th className="py-1 font-medium">Subject</th>
                  <th className="py-1 text-right font-medium">Total</th>
                  <th className="py-1 text-right font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {state.result.rows.map((r) => (
                  <tr key={r.subject}>
                    <td className="py-1.5 text-zinc-900">{r.subject}</td>
                    <td className="py-1.5 text-right text-zinc-500">{r.total}/100</td>
                    <td className="py-1.5 text-right font-medium text-zinc-900">
                      {r.grade ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
