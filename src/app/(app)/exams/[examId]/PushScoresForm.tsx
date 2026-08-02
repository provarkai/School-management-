"use client";

import { useActionState } from "react";
import { pushExamScores, type PushScoresState } from "../actions";

const initialState: PushScoresState = {};

export function PushScoresForm({
  examId,
  subjects,
  defaultSubject,
  submittedCount,
}: {
  examId: string;
  subjects: string[];
  defaultSubject: string;
  submittedCount: number;
}) {
  const action = pushExamScores.bind(null, examId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Send scores to report cards</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Copies the {submittedCount} submitted score{submittedCount === 1 ? "" : "s"} into the
          report card, scaled to the half you pick. Students who didn&rsquo;t sit the exam are
          skipped, and the other half of the subject&rsquo;s score is left as-is.
        </p>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Subject
          <select
            name="subject"
            defaultValue={defaultSubject}
            required
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">Choose…</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-zinc-700">
          Fills which half?
          <select
            name="slot"
            defaultValue="exam"
            className="mt-1 block rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="exam">Exam score (out of 60)</option>
            <option value="ca">CA score (out of 40)</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={pending || submittedCount === 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Pushing…" : "Push scores"}
        </button>
      </div>
    </form>
  );
}
