"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveScore, deleteScore, type ScoreFormState } from "../actions";

const initialState: ScoreFormState = {};

export function ScoreForm({
  studentId,
  subjects,
}: {
  studentId: string;
  subjects: string[];
}) {
  const [state, action, pending] = useActionState(saveScore, initialState);

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No subjects set up yet.{" "}
        <Link href="/subjects" className="font-medium text-zinc-700 underline">
          Add subjects
        </Link>{" "}
        before entering scores.
      </p>
    );
  }

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      <input type="hidden" name="student_id" value={studentId} />
      <div className="sm:col-span-4">
        {state.error && (
          <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="mb-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Subject
        <select
          name="subject"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="" disabled>
            Select a subject
          </option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-zinc-700">
        CA score (/40)
        <input
          name="ca_score"
          type="number"
          min={0}
          max={40}
          step="0.5"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Exam score (/60)
        <input
          name="exam_score"
          type="number"
          min={0}
          max={60}
          step="0.5"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save subject score"}
      </button>
    </form>
  );
}

export function DeleteScoreButton({
  resultId,
  studentId,
}: {
  resultId: string;
  studentId: string;
}) {
  return (
    <form action={deleteScore.bind(null, resultId, studentId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
