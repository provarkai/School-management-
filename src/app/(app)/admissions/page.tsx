import Link from "next/link";
import { requirePermission } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { TableSearch } from "@/components/TableSearch";
import { AddProspectForm } from "./AddProspectForm";
import { ProspectCard, type Prospect } from "./ProspectCard";
import { PROSPECT_STATUSES, STATUS_LABELS, type ProspectStatus } from "./statuses";

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { profile, school, isManager } = await requirePermission("admissions");
  const { status: statusFilter } = await searchParams;
  const supabase = await createClient();

  const session = school?.current_session ?? "";

  const [{ data: campuses }, { data: classes }, { data: prospectRows }] = await Promise.all([
    supabase
      .from("campuses")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", school?.current_term ?? "1")
      .order("name"),
    supabase
      .from("admission_prospects")
      .select("*")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .order("created_at", { ascending: false }),
  ]);

  const allProspects = (prospectRows ?? []) as unknown as Prospect[];
  const prospects = statusFilter
    ? allProspects.filter((p) => p.status === statusFilter)
    : allProspects;

  const countByStatus = new Map<string, number>();
  for (const p of allProspects) {
    countByStatus.set(p.status, (countByStatus.get(p.status) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Admissions</h1>
        <p className="text-sm text-zinc-500">
          {session} intake — track prospects from first inquiry through entrance test to
          enrollment.
        </p>
      </div>

      <AddProspectForm campuses={campuses ?? []} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/admissions"
          className={`rounded-full px-3 py-1 ${
            !statusFilter ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          All ({allProspects.length})
        </Link>
        {PROSPECT_STATUSES.map((s: ProspectStatus) => (
          <Link
            key={s}
            href={`/admissions?status=${s}`}
            className={`rounded-full px-3 py-1 ${
              statusFilter === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {STATUS_LABELS[s]} ({countByStatus.get(s) ?? 0})
          </Link>
        ))}
      </div>

      {prospects.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No prospects {statusFilter ? `with status "${STATUS_LABELS[statusFilter as ProspectStatus]}"` : ""}{" "}
          for {session} yet.
        </p>
      ) : (
        <div data-search-scope className="space-y-3">
          <TableSearch placeholder="Search prospects…" />
          {prospects.map((p) => (
            <div
              key={p.id}
              data-search-row={[
                p.full_name,
                p.desired_class,
                p.parent_name,
                p.parent_phone,
                p.parent_email,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <ProspectCard prospect={p} classes={classes ?? []} canConvert={isManager} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
