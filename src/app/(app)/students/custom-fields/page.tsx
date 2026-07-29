import Link from "next/link";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { NewFieldForm } from "./NewFieldForm";
import { DeleteFieldButton } from "./DeleteFieldButton";

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
};

export default async function CustomFieldsPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: fields } = await supabase
    .from("student_field_definitions")
    .select("id, label, field_type, options")
    .eq("school_id", profile.school_id ?? "")
    .order("created_at");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/students" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          ← Students
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Custom student fields</h1>
        <p className="text-sm text-zinc-500">
          Add extra fields specific to your school — they&apos;ll show up on every student&apos;s
          registration and detail page.
        </p>
      </div>

      <NewFieldForm />

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        {(fields ?? []).length === 0 ? (
          <p className="p-5 text-sm text-zinc-400">No custom fields defined yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(fields ?? []).map((field) => (
              <li key={field.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{field.label}</p>
                  <p className="text-xs text-zinc-400">
                    {TYPE_LABELS[field.field_type] ?? field.field_type}
                    {field.options && field.options.length > 0 ? ` — ${field.options.join(", ")}` : ""}
                  </p>
                </div>
                <DeleteFieldButton fieldId={field.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
