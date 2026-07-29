"use client";

import { useActionState } from "react";
import { setStudentFieldValues, type StudentFieldValuesState } from "../actions";

const initialState: StudentFieldValuesState = {};

interface FieldDef {
  id: string;
  label: string;
  field_type: string;
  options: string[] | null;
}

export function CustomFieldValuesForm({
  studentId,
  fieldDefs,
  values,
  editable,
}: {
  studentId: string;
  fieldDefs: FieldDef[];
  values: Map<string, string | null>;
  editable: boolean;
}) {
  const action = setStudentFieldValues.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (fieldDefs.length === 0) return null;

  if (!editable) {
    return (
      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm">
        {fieldDefs.map((def) => (
          <div key={def.id}>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{def.label}</dt>
            <dd className="mt-0.5 text-zinc-900">{values.get(def.id) || "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        {state.error && (
          <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}
      </div>
      {fieldDefs.map((def) => (
        <label key={def.id} className="text-sm font-medium text-zinc-700">
          {def.label}
          {def.field_type === "select" ? (
            <select
              name={`field_${def.id}`}
              defaultValue={values.get(def.id) ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">—</option>
              {(def.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={`field_${def.id}`}
              type={def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text"}
              defaultValue={values.get(def.id) ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Saving…" : "Save custom fields"}
      </button>
    </form>
  );
}
