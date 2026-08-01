import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { proprietorTitle } from "@/lib/format";
import type { Gender } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  staff: "Non-teaching staff",
};

function roleLabel(role: string, gender: Gender | null): string {
  return role === "proprietor" ? proprietorTitle(gender) : ROLE_LABELS[role] ?? role;
}

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: person } = await supabase
    .from("app_users")
    .select(
      "id, name, email, phone, role, subject, job_title, campus_id, photo_url, gender, is_school_admin"
    )
    .eq("id", id)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!person) notFound();

  const [{ data: campus }, { data: classes }] = await Promise.all([
    person.campus_id
      ? supabase.from("campuses").select("name").eq("id", person.campus_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("classes").select("name").eq("teacher_id", person.id).order("name"),
  ]);

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/staff" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← Staff
      </Link>

      <div className="flex items-center gap-4">
        <Avatar url={person.photo_url} name={person.name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{person.name}</h1>
          <p className="text-sm text-zinc-500">
            {roleLabel(person.role, person.gender)}
            {person.is_school_admin ? " · Admin" : ""}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm">
        <Info label="Email" value={person.email ?? "—"} />
        <Info label="Phone" value={person.phone ?? "—"} />
        {person.role === "teacher" && <Info label="Subject" value={person.subject ?? "—"} />}
        {person.role === "staff" && <Info label="Job title" value={person.job_title ?? "—"} />}
        <Info label="Campus" value={campus?.name ?? "—"} />
        <Info
          label="Classes taught"
          value={(classes ?? []).length > 0 ? (classes ?? []).map((c) => c.name).join(", ") : "—"}
        />
      </dl>

      {person.role === "teacher" && (
        <Link
          href="/staff-performance"
          className="inline-block rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          View performance →
        </Link>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
