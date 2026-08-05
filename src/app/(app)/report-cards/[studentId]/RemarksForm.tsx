"use client";

import { useActionState, useState, useTransition } from "react";
import { saveRemarks, draftRemark, type RemarkFormState } from "../actions";

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
  const [teacherText, setTeacherText] = useState(teacherRemark ?? "");
  const [principalText, setPrincipalText] = useState(principalRemark ?? "");
  const [draftingTeacher, startDraftingTeacher] = useTransition();
  const [draftingPrincipal, startDraftingPrincipal] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);

  function draft(kind: "teacher" | "principal") {
    setDraftError(null);
    const start = kind === "teacher" ? startDraftingTeacher : startDraftingPrincipal;
    start(async () => {
      const result = await draftRemark(studentId, kind);
      if (result.error) {
        setDraftError(result.error);
        return;
      }
      if (result.text) {
        if (kind === "teacher") setTeacherText(result.text);
        else setPrincipalText(result.text);
      }
    });
  }

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
      {draftError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{draftError}</p>
      )}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="teacher_remark" className="block text-sm font-medium text-zinc-700">
            Class teacher&apos;s remark
          </label>
          <button
            type="button"
            onClick={() => draft("teacher")}
            disabled={draftingTeacher}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {draftingTeacher ? "Drafting…" : "✨ Draft with AI"}
          </button>
        </div>
        <textarea
          id="teacher_remark"
          name="teacher_remark"
          value={teacherText}
          onChange={(e) => setTeacherText(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
      {isManager ? (
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="principal_remark" className="block text-sm font-medium text-zinc-700">
              {principalLabel}&apos;s remark
            </label>
            <button
              type="button"
              onClick={() => draft("principal")}
              disabled={draftingPrincipal}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {draftingPrincipal ? "Drafting…" : "✨ Draft with AI"}
            </button>
          </div>
          <textarea
            id="principal_remark"
            name="principal_remark"
            value={principalText}
            onChange={(e) => setPrincipalText(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
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
