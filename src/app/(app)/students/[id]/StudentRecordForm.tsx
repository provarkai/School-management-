"use client";

import { useActionState } from "react";
import { updateStudentRecord, type StudentRecordState } from "../actions";

const initialState: StudentRecordState = {};

export interface StudentRecord {
  admission_number: string | null;
  gender: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  blood_group: string | null;
  genotype: string | null;
  allergies: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export function StudentRecordForm({
  studentId,
  record,
}: {
  studentId: string;
  record: StudentRecord;
}) {
  const action = updateStudentRecord.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Full record</h2>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Admission number" name="admission_number" defaultValue={record.admission_number} />
        <label className="text-sm font-medium text-zinc-700">
          Gender
          <select
            name="gender"
            defaultValue={record.gender ?? ""}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <Field label="Home address" name="address" defaultValue={record.address} span />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Second guardian
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Name" name="guardian_name" defaultValue={record.guardian_name} />
          <Field label="Phone" name="guardian_phone" defaultValue={record.guardian_phone} />
          <Field
            label="Relationship"
            name="guardian_relationship"
            defaultValue={record.guardian_relationship}
            placeholder="e.g. Uncle"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Medical &amp; emergency
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Blood group" name="blood_group" defaultValue={record.blood_group} placeholder="e.g. O+" />
          <Field label="Genotype" name="genotype" defaultValue={record.genotype} placeholder="e.g. AA" />
          <Field label="Allergies" name="allergies" defaultValue={record.allergies} span />
          <Field
            label="Emergency contact"
            name="emergency_contact_name"
            defaultValue={record.emergency_contact_name}
          />
          <Field
            label="Emergency phone"
            name="emergency_contact_phone"
            defaultValue={record.emergency_contact_phone}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save record"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  span,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  placeholder?: string;
  span?: boolean;
}) {
  return (
    <label className={`text-sm font-medium text-zinc-700 ${span ? "sm:col-span-2" : ""}`}>
      {label}
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
    </label>
  );
}
