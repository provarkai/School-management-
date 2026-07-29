"use client";

import { useActionState } from "react";
import {
  createBehaviorIncident,
  deleteBehaviorIncident,
  type BehaviorIncidentFormState,
} from "../actions";
import type { BehaviorCategory, BehaviorSeverity } from "@/lib/types";

const initialState: BehaviorIncidentFormState = {};

interface IncidentRow {
  id: string;
  incident_date: string;
  category: BehaviorCategory;
  severity: BehaviorSeverity;
  description: string;
  action_taken: string | null;
}

const SEVERITY_STYLE: Record<BehaviorSeverity, string> = {
  minor: "bg-zinc-100 text-zinc-700",
  major: "bg-amber-100 text-amber-800",
  severe: "bg-red-100 text-red-700",
};

export function BehaviorRecord({
  studentId,
  incidents,
  canDelete,
}: {
  studentId: string;
  incidents: IncidentRow[];
  canDelete: boolean;
}) {
  const action = createBehaviorIncident.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-4">
      <form
        action={formAction}
        className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          {state.error && (
            <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          {state.success && (
            <p className="mb-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {state.success}
            </p>
          )}
        </div>
        <label className="text-sm font-medium text-zinc-700">
          Type
          <select
            name="category"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="demerit">Demerit (misconduct)</option>
            <option value="merit">Merit (commendation)</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Severity
          <select
            name="severity"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="severe">Severe</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
          Description
          <textarea
            name="description"
            required
            rows={2}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
          Action taken (optional)
          <input
            name="action_taken"
            placeholder="e.g. Warning issued, parent notified, detention"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Date
          <input
            name="incident_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit sm:self-end"
        >
          {pending ? "Saving…" : "Log incident"}
        </button>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        {incidents.length === 0 ? (
          <p className="p-5 text-sm text-zinc-400">No behavior incidents logged yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {incidents.map((incident) => (
              <li key={incident.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[incident.severity]}`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`text-xs font-medium ${incident.category === "merit" ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {incident.category === "merit" ? "Merit" : "Demerit"}
                    </span>
                    <span className="text-xs text-zinc-400">{incident.incident_date}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-900">{incident.description}</p>
                  {incident.action_taken && (
                    <p className="mt-1 text-xs text-zinc-500">Action: {incident.action_taken}</p>
                  )}
                </div>
                {canDelete && (
                  <form action={deleteBehaviorIncident.bind(null, studentId, incident.id)}>
                    <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
