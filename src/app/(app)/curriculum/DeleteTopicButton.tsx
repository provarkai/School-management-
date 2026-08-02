"use client";

import { deleteTopic } from "./actions";

export function DeleteTopicButton({ topicId }: { topicId: string }) {
  return (
    <form action={deleteTopic.bind(null, topicId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
