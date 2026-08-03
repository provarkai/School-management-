"use client";

import { submitLessonNote, deleteLessonNote, reviewLessonNote } from "./actions";
import type { LessonNoteStatus } from "@/lib/types";

export function LessonNoteActions({
  noteId,
  status,
  filePath,
  isAuthor,
  isManager,
}: {
  noteId: string;
  status: LessonNoteStatus;
  filePath: string | null;
  isAuthor: boolean;
  isManager: boolean;
}) {
  if (isManager && status === "submitted") {
    return (
      <form
        action={reviewLessonNote.bind(null, noteId, "approved")}
        className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3"
      >
        <label className="flex-1 text-xs font-medium text-zinc-500">
          Review note (optional)
          <input
            name="review_note"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
        <button
          type="submit"
          formAction={reviewLessonNote.bind(null, noteId, "approved")}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Approve
        </button>
        <button
          type="submit"
          formAction={reviewLessonNote.bind(null, noteId, "needs_revision")}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Needs revision
        </button>
      </form>
    );
  }

  if (isAuthor && (status === "draft" || status === "needs_revision")) {
    return (
      <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
        <form action={submitLessonNote.bind(null, noteId)}>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
          >
            Submit for review
          </button>
        </form>
        {status === "draft" && (
          <form
            action={deleteLessonNote.bind(null, noteId, filePath)}
            onSubmit={(e) => {
              if (!confirm("Delete this draft?")) e.preventDefault();
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Delete
            </button>
          </form>
        )}
      </div>
    );
  }

  return null;
}
