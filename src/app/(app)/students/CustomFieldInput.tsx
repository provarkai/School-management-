import { NIGERIAN_STATES } from "@/lib/nigerianStates";

export interface CustomFieldDef {
  id: string;
  label: string;
  field_type: string;
  options: string[] | null;
}

/** One school-defined custom field's input, shared by the new-student and
 * edit-student forms so both stay in sync. "State of Origin" is special-cased
 * to a fixed dropdown of Nigerian states regardless of how the school set the
 * field up (text or select with its own options) — every other field renders
 * from its stored field_type/options as usual. */
export function CustomFieldInput({
  def,
  defaultValue,
}: {
  def: CustomFieldDef;
  defaultValue?: string | null;
}) {
  const name = `field_${def.id}`;
  const isStateOfOrigin = def.label.trim().toLowerCase() === "state of origin";

  return (
    <label className="block text-sm font-medium text-zinc-700">
      {def.label}
      {isStateOfOrigin ? (
        <select
          name={name}
          defaultValue={defaultValue ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">—</option>
          {NIGERIAN_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      ) : def.field_type === "select" ? (
        <select
          name={name}
          defaultValue={defaultValue ?? ""}
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
          name={name}
          type={def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text"}
          defaultValue={defaultValue ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      )}
    </label>
  );
}
