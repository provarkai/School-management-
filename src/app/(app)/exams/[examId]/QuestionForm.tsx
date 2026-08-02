"use client";

import { useActionState } from "react";
import { addQuestion, type QuestionFormState } from "../actions";

const initialState: QuestionFormState = {};

export function QuestionForm({ examId }: { examId: string }) {
  const action = addQuestion.bind(null, examId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Add a question</h2>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <label className="block text-sm font-medium text-zinc-700">
        Question
        <textarea
          name="question_text"
          required
          rows={2}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <div className="space-y-2">
        {[1, 2, 3, 4].map((n) => (
          <label key={n} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="correct_option"
              value={n - 1}
              required
              className="h-4 w-4 border-zinc-300"
            />
            <input
              name={`option_${n}`}
              required={n <= 2}
              placeholder={`Option ${n}${n > 2 ? " (optional)" : ""}`}
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-zinc-400">Select the radio button next to the correct option.</p>

      <label className="block max-w-[8rem] text-sm font-medium text-zinc-700">
        Points
        <input
          name="points"
          type="number"
          min="0.5"
          step="0.5"
          defaultValue={1}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add question"}
      </button>
    </form>
  );
}
