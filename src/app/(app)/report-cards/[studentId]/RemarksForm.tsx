"use client";

import { useActionState } from "react";
import { saveRemarks, type RemarkFormState } from "../actions";

const initialState: RemarkFormState = {};

export function RemarksForm({
  studentId,
  teacherRemark,
  principalRemark,
  principalLabel,
  isManager,
}: {
  studentId: string;
  teacherRemark: string | null;
  principalRemark: string | null;
  principalLabel: string;
  isManager: boolean;
}) {
  const [state, action, pending] = useActionState(saveRemarks, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="student_id" value={studentId} />
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      <label className="block text-sm font-medium text-zinc-700">
        Class teacher&apos;s remark
        <textarea
          name="teacher_remark"
          defaultValue={teacherRemark ?? ""}
          rows={2}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      {isManager ? (
        <label className="block text-sm font-medium text-zinc-700">
          {principalLabel}&apos;s remark
          <textarea
            name="principal_remark"
            defaultValue={principalRemark ?? ""}
            rows={2}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
      ) : (
        principalRemark && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {principalLabel}&apos;s remark
            </p>
            <p className="mt-1 text-sm text-zinc-700">{principalRemark}</p>
          </div>
        )
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save remarks"}
      </button>
    </form>
  );
}
