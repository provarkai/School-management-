"use client";

import { deleteNotice } from "./actions";

export function DeleteNoticeButton({ noticeId }: { noticeId: string }) {
  return (
    <form action={deleteNotice.bind(null, noticeId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
