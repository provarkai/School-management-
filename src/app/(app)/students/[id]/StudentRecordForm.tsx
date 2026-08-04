"use client";

import { useActionState } from "react";
import { updateStudentRecord, type StudentRecordState } from "../actions";
import { CustomFieldInput, type CustomFieldDef } from "../CustomFieldInput";

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
  hostel_room_id: string | null;
  bus_stop_id: string | null;
}

export interface HostelRoomOption {
  id: string;
  name: string;
  hostelName: string;
}

export interface BusStopOption {
  id: string;
  name: string;
  routeName: string;
}

export function StudentRecordForm({
  studentId,
  record,
  hostelRooms,
  busStops,
  fieldDefs,
  fieldValues,
}: {
  studentId: string;
  record: StudentRecord;
  hostelRooms: HostelRoomOption[];
  busStops: BusStopOption[];
  fieldDefs: CustomFieldDef[];
  fieldValues: Map<string, string | null>;
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
        <div className="text-sm font-medium text-zinc-700">
          Admission number
          <p className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-500">
            {record.admission_number ?? "—"}
          </p>
          <span className="mt-1 block text-xs font-normal text-zinc-400">
            Assigned automatically and fixed for the student&rsquo;s whole time at the school —
            not editable here. The prefix for new numbers is set in Settings.
          </span>
        </div>
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
          Hostel &amp; transport
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            Hostel room
            <select
              name="hostel_room_id"
              defaultValue={record.hostel_room_id ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">Not assigned</option>
              {hostelRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.hostelName} — {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Bus stop
            <select
              name="bus_stop_id"
              defaultValue={record.bus_stop_id ?? ""}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">Not assigned</option>
              {busStops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.routeName} — {stop.name}
                </option>
              ))}
            </select>
          </label>
        </div>
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

      {fieldDefs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Other details
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fieldDefs.map((def) => (
              <CustomFieldInput key={def.id} def={def} defaultValue={fieldValues.get(def.id)} />
            ))}
          </div>
        </div>
      )}

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
