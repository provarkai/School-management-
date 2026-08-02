"use client";

import { useTransition } from "react";
import { updateExamStatus } from "../actions";

export function StatusButtons({ examId, status }: { examId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  if (status === "draft") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => updateExamStatus(examId, "published"))}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish exam"}
      </button>
    );
  }

  if (status === "published") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => updateExamStatus(examId, "closed"))}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Closing…" : "Close exam"}
      </button>
    );
  }

  return <span className="text-sm text-zinc-400">Closed — no longer accepting attempts.</span>;
}
