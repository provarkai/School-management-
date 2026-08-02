"use client";

import { useTransition } from "react";
import { setTopicProgress } from "./actions";

const STATUS_TEXT_STYLES: Record<string, string> = {
  not_started: "text-zinc-500",
  in_progress: "text-amber-700",
  completed: "text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

export function TopicProgressSelect({
  classId,
  topicId,
  status,
}: {
  classId: string;
  topicId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(() =>
          setTopicProgress(classId, topicId, e.target.value as "not_started" | "in_progress" | "completed")
        )
      }
      className={`rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 ${STATUS_TEXT_STYLES[status]}`}
    >
      {Object.entries(STATUS_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
