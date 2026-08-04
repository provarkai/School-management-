import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/current-admin";
import { createClient } from "@/lib/supabase/server";
import { SchoolStatusButton } from "../../SchoolStatusButton";
import { FacilitiesToggleButton } from "../../FacilitiesToggleButton";
import type { School } from "@/lib/types";

interface SchoolContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "proprietor" | "teacher" | "staff";
  is_school_admin: boolean;
  job_title: string | null;
  created_at: string;
}

interface SchoolStats {
  school_id: string;
  student_count: number;
  staff_count: number;
  last_activity: string | null;
}

export default async function AdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: school }, { data: statsRows }, { data: contacts }] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("platform_school_stats"),
    supabase.rpc("platform_school_contacts", { target_school_id: id }),
  ]);

  if (!school) {
    notFound();
  }

  const stats = ((statsRows ?? []) as SchoolStats[]).find((s) => s.school_id === id);
  const contactRows = (contacts ?? []) as SchoolContact[];
  const proprietor = contactRows.find((c) => c.role === "proprietor");
  const admins = contactRows.filter((c) => c.role !== "proprietor");

  const typedSchool = school as School;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← All schools
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{typedSchool.name}</h1>
          <p className="text-sm text-zinc-500">
            {typedSchool.current_session} · Term {typedSchool.current_term}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <SchoolStatusButton schoolId={typedSchool.id} status={typedSchool.status} />
          <FacilitiesToggleButton schoolId={typedSchool.id} enabled={typedSchool.facilities_enabled} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={String(stats?.student_count ?? 0)} />
        <StatCard label="Staff" value={String(stats?.staff_count ?? 0)} />
        <StatCard
          label="Last activity"
          value={stats?.last_activity ? stats.last_activity.slice(0, 10) : "—"}
        />
        <StatCard label="Signed up" value={typedSchool.created_at.slice(0, 10)} />
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          School profile
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Address" value={typedSchool.address} />
          <Field label="Phone" value={typedSchool.phone} />
          <Field label="Admission prefix" value={typedSchool.admission_prefix} />
          <Field
            label="Status"
            value={
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  typedSchool.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {typedSchool.status}
              </span>
            }
          />
          <Field
            label="Facilities module"
            value={
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  typedSchool.facilities_enabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {typedSchool.facilities_enabled ? "enabled" : "disabled"}
              </span>
            }
          />
        </dl>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Proprietor
        </h2>
        {proprietor ? (
          <ContactRow contact={proprietor} />
        ) : (
          <p className="text-sm text-zinc-400">No proprietor account found for this school.</p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Delegated school admins
        </h2>
        {admins.length === 0 ? (
          <p className="text-sm text-zinc-400">No delegated admins — only the proprietor manages this school.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {admins.map((admin) => (
              <li key={admin.id} className="py-3 first:pt-0 last:pb-0">
                <ContactRow contact={admin} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{value || <span className="text-zinc-400">—</span>}</dd>
    </div>
  );
}

function ContactRow({ contact }: { contact: SchoolContact }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
      <div>
        <p className="text-sm font-medium text-zinc-900">
          {contact.name}
          {contact.role !== "proprietor" && (
            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {contact.job_title || "School admin"}
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {contact.email || "No email"} · {contact.phone || "No phone"}
        </p>
      </div>
      <p className="text-xs text-zinc-400">Joined {contact.created_at.slice(0, 10)}</p>
    </div>
  );
}
