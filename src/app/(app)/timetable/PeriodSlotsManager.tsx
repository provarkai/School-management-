"use client";

import { useActionState, useState, useTransition } from "react";
import type { PeriodSlot } from "@/lib/types";
import { createPeriodSlot, deletePeriodSlot, generateDefaultPeriods, type PeriodSlotFormState } from "./actions";

const initialState: PeriodSlotFormState = {};

export function PeriodSlotsManager({ periodSlots }: { periodSlots: PeriodSlot[] }) {
  const [state, action, pending] = useActionState(createPeriodSlot, initialState);
  const [expanded, setExpanded] = useState(periodSlots.length === 0);
  const [generating, startGenerate] = useTransition();

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Daily periods</h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          {expanded ? "Hide" : "Manage"}
        </button>
      </div>

      {periodSlots.length === 0 && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No periods set up yet.{" "}
          <button
            type="button"
            disabled={generating}
            onClick={() => startGenerate(async () => { await generateDefaultPeriods(); })}
            className="font-semibold underline hover:no-underline disabled:opacity-50"
          >
            {generating ? "Adding…" : "Use a default 7-period day"}
          </button>{" "}
          or add periods manually below.
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="overflow-x-auto rounded-md border border-zinc-100">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <tbody className="divide-y divide-zinc-50">
                {periodSlots.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-1.5 font-medium text-zinc-900">{p.label}</td>
                    <td className="px-3 py-1.5 text-zinc-500">
                      {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-400">{p.is_break ? "Break" : ""}</td>
                    <td className="px-3 py-1.5 text-right">
                      <form action={deletePeriodSlot.bind(null, p.id)}>
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {periodSlots.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-zinc-400">
                      No periods yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
            <label className="text-sm font-medium text-zinc-700">
              Label
              <input
                name="label"
                required
                placeholder="e.g. Period 8"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Start time
              <input
                name="start_time"
                type="time"
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              End time
              <input
                name="end_time"
                type="time"
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input name="is_break" type="checkbox" className="h-4 w-4 rounded border-zinc-300" />
              Break/assembly
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-4 sm:w-fit"
            >
              {pending ? "Adding…" : "Add period"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
