"use client";

import { useActionState } from "react";
import { updatePromotionCriteria, type PromotionFormState } from "./actions";

const initialState: PromotionFormState = {};

export function PromotionCriteriaForm({
  minAverage,
  subjectPassMark,
  maxFailedSubjects,
}: {
  minAverage: number;
  subjectPassMark: number;
  maxFailedSubjects: number;
}) {
  const [state, action, pending] = useActionState(updatePromotionCriteria, initialState);

  return (
    <details className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-zinc-900">
        Promotion criteria
        <span className="ml-2 font-normal text-zinc-500">
          — average {minAverage}%, pass mark {subjectPassMark}%, at most {maxFailedSubjects}{" "}
          failed {maxFailedSubjects === 1 ? "subject" : "subjects"}
        </span>
      </summary>

      <form action={action} className="space-y-4 border-t border-zinc-100 px-5 py-4">
        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
        <p className="text-sm text-zinc-500">
          These decide what the app recommends for each student below. Nothing is applied
          automatically — you always confirm or override before promoting.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-medium text-zinc-700">
            Minimum session average
            <input
              name="min_average"
              type="number"
              min={0}
              max={100}
              step="0.5"
              defaultValue={minAverage}
              required
              className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <span className="mt-1 block text-xs font-normal text-zinc-400">%</span>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Subject pass mark
            <input
              name="subject_pass_mark"
              type="number"
              min={0}
              max={100}
              step="0.5"
              defaultValue={subjectPassMark}
              required
              className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <span className="mt-1 block text-xs font-normal text-zinc-400">%</span>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Subjects a student may fail
            <input
              name="max_failed_subjects"
              type="number"
              min={0}
              max={30}
              step="1"
              defaultValue={maxFailedSubjects}
              required
              className="mt-1 block w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            <span className="mt-1 block text-xs font-normal text-zinc-400">and still go up</span>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save criteria"}
        </button>
      </form>
    </details>
  );
}
