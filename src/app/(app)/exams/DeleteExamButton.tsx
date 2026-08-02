"use client";

import { deleteExam } from "./actions";

export function DeleteExamButton({ examId }: { examId: string }) {
  return (
    <form action={deleteExam.bind(null, examId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
