"use client";

import { deleteQuestion } from "../actions";

export function DeleteQuestionButton({ questionId, examId }: { questionId: string; examId: string }) {
  return (
    <form action={deleteQuestion.bind(null, questionId, examId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
