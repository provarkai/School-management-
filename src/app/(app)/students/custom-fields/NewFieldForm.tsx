"use client";

import { useActionState, useState } from "react";
import { createFieldDefinition, type FieldDefinitionFormState } from "./actions";

const initialState: FieldDefinitionFormState = {};

export function NewFieldForm() {
  const [state, formAction, pending] = useActionState(createFieldDefinition, initialState);
  const [fieldType, setFieldType] = useState("text");

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        {state.error && (
          <p className="mb-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
      </div>
      <label className="text-sm font-medium text-zinc-700">
        Field label
        <input
          name="label"
          required
          placeholder="e.g. Blood group"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Type
        <select
          name="field_type"
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="select">Dropdown</option>
        </select>
      </label>
      {fieldType === "select" && (
        <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
          Options (comma-separated)
          <input
            name="options"
            placeholder="e.g. A+, A-, B+, B-, O+, O-"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Adding…" : "Add field"}
      </button>
    </form>
  );
}
