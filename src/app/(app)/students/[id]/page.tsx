import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ShareLinkButton } from "./ShareLinkButton";
import { ParentEmailForm } from "./ParentEmailForm";
import { ParentInviteSection } from "./ParentInviteSection";
import { AcademicHistory } from "./AcademicHistory";
import { BehaviorRecord } from "./BehaviorRecord";
import { CustomFieldValuesForm } from "./CustomFieldValuesForm";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { DocumentsList } from "./DocumentsList";
import { AvatarUploader } from "@/components/AvatarUploader";
import { Avatar } from "@/components/Avatar";
import { BackLink } from "@/components/BackLink";
import { saveStudentPhoto } from "../actions";
import {
  StudentRecordForm,
  type StudentRecord,
  type HostelRoomOption,
  type BusStopOption,
} from "./StudentRecordForm";
import { WithdrawalSection } from "./WithdrawalForm";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, isManager } = await requireUser();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select(
      "id, school_id, full_name, class_id, date_of_birth, parent_name, parent_phone, parent_email, admission_date, status, access_token, photo_url, admission_number, gender, address, guardian_name, guardian_phone, guardian_relationship, blood_group, genotype, allergies, emergency_contact_name, emergency_contact_phone, withdrawn_at, withdrawal_reason, conduct_remark, hostel_room_id, bus_stop_id"
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
    { data: documentRows },
    { data: promotions },
    { data: hostelRoomRows },
    { data: busStopRows },
    { data: invitations },
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
    supabase
      .from("student_documents")
      .select("id, label, file_name, file_path, size_bytes, created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_promotions")
      .select(
        "id, from_session, to_session, from_class_name, to_class_name, decision, average_score, subjects_failed, subjects_counted, overridden"
      )
      .eq("student_id", student.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("hostel_rooms")
      .select("id, name, hostels(name)")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("bus_stops")
      .select("id, name, bus_routes(name)")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("parent_invitations")
      .select("id, created_at, expires_at, redeemed_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const hostelRooms: HostelRoomOption[] = (hostelRoomRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    hostelName: (r.hostels as unknown as { name: string } | null)?.name ?? "Hostel",
  }));
  const busStops: BusStopOption[] = (busStopRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    routeName: (s.bus_routes as unknown as { name: string } | null)?.name ?? "Route",
  }));

  const fieldValueByDefId = new Map((fieldValues ?? []).map((v) => [v.field_definition_id, v.value]));

  const documents = await Promise.all(
    (documentRows ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("student-documents")
        .createSignedUrl(doc.file_path, 3600);
      return { ...doc, signedUrl: signed?.signedUrl ?? null };
    })
  );

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const shareUrl = `${protocol}://${host}/p/${student.access_token}`;

  return (
    <div className="max-w-lg space-y-6">
      <BackLink href="/students" label="Students" />
      <div className="flex items-center gap-4">
        {isManager ? (
          <AvatarUploader
            pathPrefix={`students/${student.id}`}
            name={student.full_name}
            initialUrl={student.photo_url}
            onSave={saveStudentPhoto.bind(null, student.id)}
          />
        ) : (
          <Avatar url={student.photo_url} name={student.full_name} size="lg" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{student.full_name}</h1>
          <p className="text-sm text-zinc-500">{klass?.name ?? "No class assigned"}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm">
        <Info label="Date of birth" value={student.date_of_birth ?? "—"} />
        <Info label="Admission date" value={student.admission_date} />
        <Info label="Parent/guardian" value={student.parent_name ?? "—"} />
        <Info label="Parent phone" value={student.parent_phone ?? "—"} />
        <Info label="Parent email" value={student.parent_email ?? "—"} />
        <Info label="Status" value={student.status} />
      </dl>

      {isManager && (
        <StudentRecordForm
          studentId={student.id}
          record={student as unknown as StudentRecord}
          hostelRooms={hostelRooms}
          busStops={busStops}
        />
      )}

      {isManager && (student.status === "active" || student.status === "withdrawn") && (
        <WithdrawalSection
          studentId={student.id}
          record={{
            status: student.status,
            withdrawn_at: student.withdrawn_at,
            withdrawal_reason: student.withdrawal_reason,
            conduct_remark: student.conduct_remark,
          }}
        />
      )}

      <CustomFieldValuesForm
        studentId={student.id}
        fieldDefs={fieldDefs ?? []}
        values={fieldValueByDefId}
        editable={isManager}
      />

      {isManager && (
        <>
          <ShareLinkButton url={shareUrl} />
          <ParentEmailForm studentId={student.id} currentEmail={student.parent_email} />
          <ParentInviteSection studentId={student.id} invitations={invitations ?? []} />
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {isManager && (
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
        {isManager && (
          <a
            href={`/students/${student.id}/id-card`}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            ID card
          </a>
        )}
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

      {(promotions ?? []).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Promotion history
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Session</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Outcome</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Class</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Average</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(promotions ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-900">
                      {p.from_session} → {p.to_session}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          p.decision === "repeated"
                            ? "bg-amber-100 text-amber-700"
                            : p.decision === "graduated"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {p.decision}
                      </span>
                      {p.overridden && (
                        <span className="ml-2 text-xs text-zinc-400">overridden</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">
                      {p.from_class_name}
                      {p.to_class_name ? ` → ${p.to_class_name}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500">
                      {p.average_score === null ? "—" : `${Number(p.average_score).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500">
                      {p.subjects_counted ? `${p.subjects_failed}/${p.subjects_counted}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Behavior record
        </h2>
        <BehaviorRecord
          studentId={student.id}
          incidents={incidents ?? []}
          canDelete={isManager}
        />
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Documents</h2>
        <DocumentUploadForm studentId={student.id} schoolId={student.school_id} />
        <DocumentsList
          studentId={student.id}
          documents={documents}
          canDelete={isManager}
        />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words capitalize text-zinc-900">{value}</dd>
    </div>
  );
}
