import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ShareLinkButton } from "./ShareLinkButton";

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
      "id, full_name, class_id, date_of_birth, parent_name, parent_phone, admission_date, status, access_token"
    )
    .eq("id", id)
    .single();

  if (!student) notFound();

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

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
        <Info label="Status" value={student.status} />
      </dl>

      {profile.role === "proprietor" && <ShareLinkButton url={shareUrl} />}

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
