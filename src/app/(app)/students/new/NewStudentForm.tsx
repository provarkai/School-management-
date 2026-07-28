"use client";

import { useActionState } from "react";
import { createStudent, type StudentFormState } from "../actions";

const initialState: StudentFormState = {};

export function NewStudentForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createStudent, initialState);

  return (
    <form action={action} className="max-w-lg space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <Field label="Full name" name="full_name" required />
      <label className="block text-sm font-medium text-zinc-700">
        Class
        <select
          name="class_id"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">Unassigned</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Date of birth" name="date_of_birth" type="date" />
      <Field label="Parent/guardian name" name="parent_name" />
      <Field label="Parent/guardian phone" name="parent_phone" type="tel" placeholder="+234..." />
      <Field label="Admission date" name="admission_date" type="date" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Register student"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
    </label>
  );
}
