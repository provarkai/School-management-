import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ShareLinkButton } from "./ShareLinkButton";
import { ParentEmailForm } from "./ParentEmailForm";
import { AcademicHistory } from "./AcademicHistory";
import { BehaviorRecord } from "./BehaviorRecord";
import { CustomFieldValuesForm } from "./CustomFieldValuesForm";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, full_name, class_id, date_of_birth, parent_name, parent_phone, parent_email, admission_date, status, access_token"
    )
    .eq("id", id)
    .single();

  if (!student) notFound();

  const [
    { data: klass },
    { data: results },
    { data: fees },
    { data: attendance },
    { data: incidents },
    { data: fieldDefs },
    { data: fieldValues },
  ] = await Promise.all([
    student.class_id
      ? supabase.from("classes").select("name").eq("id", student.class_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("results")
      .select("session, term, subject, total, grade")
      .eq("student_id", student.id)
      .order("subject"),
    supabase
      .from("fee_summary")
      .select("session, term, fee_type_name, amount_expected, amount_paid, balance, status")
      .eq("student_id", student.id),
    supabase.from("attendance").select("status").eq("student_id", student.id),
    supabase
      .from("behavior_incidents")
      .select("id, incident_date, category, severity, description, action_taken")
      .eq("student_id", student.id)
      .order("incident_date", { ascending: false }),
    supabase
      .from("student_field_definitions")
      .select("id, label, field_type, options")
      .eq("school_id", profile.school_id ?? "")
      .order("created_at"),
    supabase
      .from("student_field_values")
      .select("field_definition_id, value")
      .eq("student_id", student.id),
  ]);

  const fieldValueByDefId = new Map((fieldValues ?? []).map((v) => [v.field_definition_id, v.value]));

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const shareUrl = `${protocol}://${host}/p/${student.access_token}`;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{student.full_name}</h1>
        <p className="text-sm text-zinc-500">{klass?.name ?? "No class assigned"}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm">
        <Info label="Date of birth" value={student.date_of_birth ?? "—"} />
        <Info label="Admission date" value={student.admission_date} />
        <Info label="Parent/guardian" value={student.parent_name ?? "—"} />
        <Info label="Parent phone" value={student.parent_phone ?? "—"} />
        <Info label="Parent email" value={student.parent_email ?? "—"} />
        <Info label="Status" value={student.status} />
      </dl>

      <CustomFieldValuesForm
        studentId={student.id}
        fieldDefs={fieldDefs ?? []}
        values={fieldValueByDefId}
        editable={profile.role === "proprietor"}
      />

      {profile.role === "proprietor" && (
        <>
          <ShareLinkButton url={shareUrl} />
          <ParentEmailForm studentId={student.id} currentEmail={student.parent_email} />
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {profile.role === "proprietor" && (
          <Link
            href={`/fees/student/${student.id}`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            View fee record
          </Link>
        )}
        <Link
          href={`/report-cards/${student.id}`}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Enter scores / report card
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Academic history
        </h2>
        <AcademicHistory
          results={(results ?? []).map((r) => ({ ...r, total: Number(r.total) }))}
          fees={(fees ?? []).map((f) => ({
            ...f,
            amount_expected: Number(f.amount_expected),
            amount_paid: Number(f.amount_paid),
            balance: Number(f.balance),
          }))}
          attendance={attendance ?? []}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Behavior record
        </h2>
        <BehaviorRecord
          studentId={student.id}
          incidents={incidents ?? []}
          canDelete={profile.role === "proprietor"}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 capitalize text-zinc-900">{value}</dd>
    </div>
  );
}
