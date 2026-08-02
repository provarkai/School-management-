"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitExamAttempt, type SubmitExamState } from "./actions";

const initialState: SubmitExamState = {};

interface Question {
  id: string;
  question_text: string;
  options: string[];
}

export function ExamForm({
  token,
  examId,
  questions,
  deadline,
}: {
  token: string;
  examId: string;
  questions: Question[];
  deadline: string;
}) {
  const action = submitExamAttempt.bind(null, token, examId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))
  );
  const autoSubmitted = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !autoSubmitted.current && !pending) {
        autoSubmitted.current = true;
        formRef.current?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, pending]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  if (state.success) {
    return (
      <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        Submitted! Refresh this page to see your score.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div
        className={`sticky top-0 z-10 rounded-md px-3 py-2 text-center text-sm font-semibold ${
          secondsLeft <= 60 ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-700"
        }`}
      >
        Time remaining: {minutes}:{seconds.toString().padStart(2, "0")}
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-zinc-900">
            {i + 1}. {q.question_text}
          </p>
          <div className="space-y-2">
            {q.options.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="radio"
                  name={`answer_${q.id}`}
                  value={idx}
                  className="h-4 w-4 border-zinc-300"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit exam"}
      </button>
    </form>
  );
}
