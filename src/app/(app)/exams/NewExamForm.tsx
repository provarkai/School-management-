"use client";

import { useActionState } from "react";
import { createExam, type ExamFormState } from "./actions";

const initialState: ExamFormState = {};

export function NewExamForm({
  classes,
  subjects,
  defaultClassId,
}: {
  classes: { id: string; name: string }[];
  subjects: string[];
  defaultClassId: string;
}) {
  const [state, action, pending] = useActionState(createExam, initialState);

  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <h2 className="text-sm font-semibold text-zinc-900">New exam</h2>
        {state.error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
      </div>

      <label className="text-sm font-medium text-zinc-700">
        Class
        <select
          name="class_id"
          defaultValue={defaultClassId}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Subject (optional)
        <input
          name="subject"
          list="exam-subjects"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <datalist id="exam-subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
        Title
        <input
          name="title"
          required
          placeholder="e.g. Mid-term test"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <label className="text-sm font-medium text-zinc-700">
        Duration (minutes)
        <input
          name="duration_minutes"
          type="number"
          min="1"
          defaultValue={30}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Creating…" : "Create exam"}
      </button>
    </form>
  );
}
