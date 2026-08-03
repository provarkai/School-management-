"use client";

import { setThreadStatus } from "../actions";
import type { ThreadStatus } from "@/lib/types";

export function ThreadStatusButton({
  threadId,
  status,
}: {
  threadId: string;
  status: ThreadStatus;
}) {
  const next: ThreadStatus = status === "open" ? "closed" : "open";

  return (
    <form action={setThreadStatus.bind(null, threadId, next)}>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
      >
        {status === "open" ? "Mark resolved" : "Reopen"}
      </button>
    </form>
  );
}
