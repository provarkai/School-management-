interface FieldDef {
  id: string;
  label: string;
  field_type: string;
  options: string[] | null;
}

/** Read-only display for a non-manager (e.g. a teacher viewing a student's
 * profile). Managers edit these values inline in StudentRecordForm's "Other
 * details" section instead — one form, one save, no separate card. */
export function CustomFieldValuesForm({
  fieldDefs,
  values,
}: {
  fieldDefs: FieldDef[];
  values: Map<string, string | null>;
}) {
  if (fieldDefs.length === 0) return null;

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
