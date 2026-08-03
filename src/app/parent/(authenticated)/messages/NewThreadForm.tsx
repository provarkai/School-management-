"use client";

import { useActionState, useState } from "react";
import { startThread, type MessageFormState } from "./actions";

const initialState: MessageFormState = {};

export interface MessageableChild {
  id: string;
  full_name: string;
  className: string | null;
  hasTeacher: boolean;
}

export function NewThreadForm({ students }: { students: MessageableChild[] }) {
  const [state, action, pending] = useActionState(startThread, initialState);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");

  const selected = students.find((c) => c.id === studentId);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">New message</h2>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        About
        <select
          name="student_id"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {students.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {c.className ? ` (${c.className})` : ""}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="text-sm font-medium text-zinc-700">
        To
        <div className="mt-1 flex gap-4">
          <label className="flex items-center gap-1.5 font-normal">
            <input type="radio" name="recipient_kind" value="office" defaultChecked />
            School office
          </label>
          <label className={`flex items-center gap-1.5 font-normal ${selected?.hasTeacher ? "" : "text-zinc-300"}`}>
            <input type="radio" name="recipient_kind" value="teacher" disabled={!selected?.hasTeacher} />
            Class teacher
          </label>
        </div>
        {!selected?.hasTeacher && (
          <p className="mt-1 text-xs font-normal text-zinc-400">
            No teacher assigned to this class yet — message the office instead.
          </p>
        )}
      </fieldset>
      <label className="block text-sm font-medium text-zinc-700">
        Message
        <textarea
          name="body"
          rows={3}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
