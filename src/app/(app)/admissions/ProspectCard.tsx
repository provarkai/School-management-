"use client";

import { useActionState } from "react";
import {
  convertProspectToStudent,
  deleteProspect,
  updateProspect,
  type ConvertFormState,
  type ProspectFormState,
} from "./actions";
import { PROSPECT_STATUSES, STATUS_LABELS, STATUS_STYLES, type ProspectStatus } from "./statuses";

const updateInitial: ProspectFormState = {};
const convertInitial: ConvertFormState = {};

export interface Prospect {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  desired_class: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  status: ProspectStatus;
  entrance_test_score: number | null;
  notes: string | null;
  converted_student_id: string | null;
}

export function ProspectCard({
  prospect,
  classes,
  canConvert,
}: {
  prospect: Prospect;
  classes: { id: string; name: string }[];
  canConvert: boolean;
}) {
  const updateAction = updateProspect.bind(null, prospect.id);
  const [updateState, updateFormAction, updatePending] = useActionState(updateAction, updateInitial);

  const convertAction = convertProspectToStudent.bind(null, prospect.id);
  const [convertState, convertFormAction, convertPending] = useActionState(convertAction, convertInitial);

  const enrolled = prospect.status === "enrolled" && !!prospect.converted_student_id;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{prospect.full_name}</p>
          <p className="text-xs text-zinc-400">
            {prospect.desired_class ? `Applying for ${prospect.desired_class}` : "No class specified"}
            {prospect.date_of_birth ? ` · DOB ${prospect.date_of_birth}` : ""}
          </p>
          {(prospect.parent_name || prospect.parent_phone || prospect.parent_email) && (
            <p className="mt-1 text-xs text-zinc-500">
              {[prospect.parent_name, prospect.parent_phone, prospect.parent_email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[prospect.status]}`}>
          {STATUS_LABELS[prospect.status]}
        </span>
      </div>

      {updateState.error && (
        <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{updateState.error}</p>
      )}

      <form action={updateFormAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
        <label className="text-xs font-medium text-zinc-700">
          Status
          <select
            name="status"
            defaultValue={prospect.status}
            disabled={enrolled}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50"
          >
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-700">
          Entrance test score
          <input
            name="entrance_test_score"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue={prospect.entrance_test_score ?? ""}
            disabled={enrolled}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50"
          />
        </label>
        <label className="text-xs font-medium text-zinc-700 sm:col-span-2">
          Notes
          <input
            name="notes"
            defaultValue={prospect.notes ?? ""}
            disabled={enrolled}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50"
          />
        </label>
        {!enrolled && (
          <button
            type="submit"
            disabled={updatePending}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 sm:w-fit"
          >
            {updatePending ? "Saving…" : "Save"}
          </button>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
        {enrolled ? (
          <p className="text-xs font-medium text-emerald-600">Converted to a student record.</p>
        ) : !canConvert ? (
          <p className="text-xs text-zinc-400">Ask a manager to enroll this prospect.</p>
        ) : (
          <form action={convertFormAction} className="flex flex-wrap items-center gap-2">
            <select
              name="class_id"
              defaultValue=""
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">No class yet</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={convertPending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
            >
              {convertPending ? "Converting…" : "Convert to student"}
            </button>
            {convertState.error && <span className="text-xs text-red-600">{convertState.error}</span>}
          </form>
        )}
        <form action={deleteProspect.bind(null, prospect.id)} className="ml-auto">
          <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}
