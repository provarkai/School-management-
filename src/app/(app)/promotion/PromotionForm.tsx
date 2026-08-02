"use client";

import { useActionState, useState } from "react";
import { promoteSession, type PromotionFormState } from "./actions";
import type { PromotionDecision } from "@/lib/promotionCriteria";

const initialState: PromotionFormState = {};

export interface PromotionStudent {
  id: string;
  name: string;
  average: number | null;
  subjectsCounted: number;
  subjectsFailed: number;
  recommendation: PromotionDecision;
  reason: string;
}

export interface PromotionClass {
  id: string;
  name: string;
  students: PromotionStudent[];
}

export function PromotionForm({
  classes,
  suggestedSession,
  repeatCount,
}: {
  classes: PromotionClass[];
  suggestedSession: string;
  repeatCount: number;
}) {
  const [state, action, pending] = useActionState(promoteSession, initialState);
  const [graduating, setGraduating] = useState<Record<string, boolean>>({});
  const [decisions, setDecisions] = useState<Record<string, PromotionDecision>>(() =>
    Object.fromEntries(
      classes.flatMap((c) => c.students.map((s) => [s.id, s.recommendation]))
    )
  );

  function setClassDecision(c: PromotionClass, decision: PromotionDecision) {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of c.students) next[s.id] = decision;
      return next;
    });
  }

  function resetClass(c: PromotionClass) {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const s of c.students) next[s.id] = s.recommendation;
      return next;
    });
  }

  const totalRepeating = Object.values(decisions).filter((d) => d === "repeat").length;

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>
      )}

      <label className="block max-w-xs text-sm font-medium text-zinc-700">
        New session
        <input
          name="new_session"
          required
          defaultValue={suggestedSession}
          placeholder="e.g. 2026/2027"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <p className="text-sm text-zinc-500">
        The criteria recommend {repeatCount} student{repeatCount === 1 ? "" : "s"} to repeat.
        You have {totalRepeating} marked to repeat.
      </p>

      <div className="space-y-3">
        {classes.map((c) => {
          const isGraduating = !!graduating[c.id];
          const repeating = c.students.filter((s) => decisions[s.id] === "repeat").length;
          return (
            <details
              key={c.id}
              className="rounded-lg border border-zinc-200 bg-white shadow-sm"
              open={repeating > 0}
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-900">
                {c.name}
                <span className="ml-2 font-normal text-zinc-500">
                  — {c.students.length} student{c.students.length === 1 ? "" : "s"}
                  {isGraduating
                    ? " · graduating"
                    : repeating > 0
                      ? ` · ${repeating} repeating`
                      : ""}
                </span>
              </summary>

              <div className="space-y-3 border-t border-zinc-100 px-4 py-3">
                <div className="flex flex-wrap items-end gap-4">
                  <label className="text-sm font-medium text-zinc-700">
                    Promote to (new session, term 1)
                    <input
                      name={`target_${c.id}`}
                      defaultValue={c.name}
                      disabled={isGraduating}
                      className="mt-1 block w-full max-w-[14rem] rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                    />
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm font-medium text-zinc-700">
                    <input
                      type="checkbox"
                      name={`graduate_${c.id}`}
                      checked={isGraduating}
                      onChange={(e) =>
                        setGraduating((prev) => ({ ...prev, [c.id]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    Whole class is graduating
                  </label>
                </div>

                {!isGraduating && (
                  <>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setClassDecision(c, "promote")}
                        className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600 hover:bg-zinc-200"
                      >
                        Promote all
                      </button>
                      <button
                        type="button"
                        onClick={() => setClassDecision(c, "repeat")}
                        className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600 hover:bg-zinc-200"
                      >
                        Repeat all
                      </button>
                      <button
                        type="button"
                        onClick={() => resetClass(c)}
                        className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600 hover:bg-zinc-200"
                      >
                        Reset to recommended
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-zinc-200 text-sm">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-zinc-500">
                              Student
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-zinc-500">
                              Average
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-zinc-500">
                              Failed
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-zinc-500">
                              Why
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-zinc-500">
                              Decision
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {c.students.map((s) => {
                            const decision = decisions[s.id] ?? s.recommendation;
                            const overridden = decision !== s.recommendation;
                            return (
                              <tr key={s.id}>
                                <td className="px-3 py-2 font-medium text-zinc-900">{s.name}</td>
                                <td className="px-3 py-2 text-right text-zinc-500">
                                  {s.average === null ? "—" : `${s.average.toFixed(1)}%`}
                                </td>
                                <td className="px-3 py-2 text-right text-zinc-500">
                                  {s.subjectsCounted === 0
                                    ? "—"
                                    : `${s.subjectsFailed}/${s.subjectsCounted}`}
                                </td>
                                <td className="px-3 py-2 text-xs text-zinc-400">{s.reason}</td>
                                <td className="px-3 py-2">
                                  <select
                                    name={`decision_${s.id}`}
                                    value={decision}
                                    onChange={(e) =>
                                      setDecisions((prev) => ({
                                        ...prev,
                                        [s.id]: e.target.value as PromotionDecision,
                                      }))
                                    }
                                    className={`rounded-md border px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                                      decision === "repeat"
                                        ? "border-amber-300 bg-amber-50 text-amber-800"
                                        : "border-zinc-300 bg-white text-zinc-700"
                                    }`}
                                  >
                                    <option value="promote">Promote</option>
                                    <option value="repeat">Repeat</option>
                                  </select>
                                  {overridden && (
                                    <span className="ml-2 text-xs text-zinc-400">overridden</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <p className="text-xs text-zinc-400">
        Leaving &ldquo;Promote to&rdquo; blank skips that class entirely — nobody in it moves,
        repeats, or is recorded. Repeaters stay in a class of the same name in the new session.
        Old classes and their attendance/results history are kept, not deleted.
      </p>

      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (
            !confirm(
              `This changes the school's active session, moves students into new classes, and holds ${totalRepeating} student${
                totalRepeating === 1 ? "" : "s"
              } back. Continue?`
            )
          ) {
            e.preventDefault();
          }
        }}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Promoting…" : "Promote & start new session"}
      </button>
    </form>
  );
}
