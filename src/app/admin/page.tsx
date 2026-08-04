import { requirePlatformAdmin } from "@/lib/current-admin";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { SchoolStatusButton } from "./SchoolStatusButton";
import { FacilitiesToggleButton } from "./FacilitiesToggleButton";
import { TableSearch } from "@/components/TableSearch";
import type { SchoolStatus } from "@/lib/types";

interface SchoolRow {
  id: string;
  name: string;
  current_session: string;
  current_term: string;
  status: SchoolStatus;
  facilities_enabled: boolean;
  created_at: string;
}

interface SchoolStats {
  school_id: string;
  student_count: number;
  staff_count: number;
  last_activity: string | null;
}

interface AdminLogRow {
  id: string;
  action: string;
  target_school_id: string | null;
  actor_id: string | null;
  created_at: string;
}

interface BackupRunRow {
  id: string;
  started_at: string;
  finished_at: string;
  school_count: number;
  succeeded_count: number;
  failed_count: number;
  config_error: string | null;
  failures: { school_id: string; school_name: string; error: string }[];
  created_at: string;
}

interface StuckPaymentRow {
  id: string;
  school_id: string;
  school_name: string;
  student_id: string | null;
  student_name: string | null;
  reference: string;
  amount: number;
  created_at: string;
}

interface MessageFailureRow {
  id: string;
  school_id: string;
  school_name: string;
  purpose: string;
  recipient_name: string | null;
  recipient_phone: string;
  error: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  school_suspended: "Suspended",
  school_reactivated: "Reactivated",
  facilities_enabled: "Enabled Facilities for",
  facilities_disabled: "Disabled Facilities for",
};

export default async function AdminDashboardPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [
    { data: totalsRows },
    { data: schools },
    { data: statsRows },
    { data: logs },
    { data: backupRuns },
    { data: stuckPayments },
    { data: messageFailures },
  ] = await Promise.all([
    supabase.rpc("platform_totals"),
    supabase
      .from("schools")
      .select("id, name, current_session, current_term, status, facilities_enabled, created_at")
      .order("created_at", { ascending: false }),
    supabase.rpc("platform_school_stats"),
    supabase
      .from("platform_admin_logs")
      .select("id, action, target_school_id, actor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("backup_runs")
      .select("id, started_at, finished_at, school_count, succeeded_count, failed_count, config_error, failures, created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.rpc("platform_stuck_payments"),
    supabase.rpc("platform_message_failures"),
  ]);

  const lastBackup = ((backupRuns ?? []) as BackupRunRow[])[0] ?? null;
  const stuckPaymentRows = (stuckPayments ?? []) as StuckPaymentRow[];
  const messageFailureRows = (messageFailures ?? []) as MessageFailureRow[];

  const totals = (totalsRows?.[0] as {
    total_schools: number;
    total_students: number;
    total_fees_processed: number;
    signups_this_month: number;
    total_outstanding_balance: number;
  } | undefined) ?? {
    total_schools: 0,
    total_students: 0,
    total_fees_processed: 0,
    signups_this_month: 0,
    total_outstanding_balance: 0,
  };

  const statsBySchoolId = new Map(
    ((statsRows ?? []) as SchoolStats[]).map((s) => [s.school_id, s])
  );

  const schoolNameById = new Map(((schools ?? []) as SchoolRow[]).map((s) => [s.id, s.name]));

  const actorIds = [...new Set(((logs ?? []) as AdminLogRow[]).map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("app_users").select("id, name").in("id", actorIds)
    : { data: [] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.id, a.name]));

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Platform overview</h1>
        <p className="text-sm text-zinc-500">Every school on the platform, at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Total schools" value={String(totals.total_schools)} />
        <StatCard label="Total students" value={String(totals.total_students)} />
        <StatCard label="Fees processed" value={naira(Number(totals.total_fees_processed))} />
        <StatCard label="Outstanding balance" value={naira(Number(totals.total_outstanding_balance))} />
        <StatCard label="Signups this month" value={String(totals.signups_this_month)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BackupHealthCard lastBackup={lastBackup} />
        <StuckPaymentsCard rows={stuckPaymentRows} />
        <MessageFailuresCard rows={messageFailureRows} />
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search schools…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">School</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Session</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Students</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Staff</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Last activity</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Created</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Facilities</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {((schools ?? []) as SchoolRow[]).map((school) => {
              const stats = statsBySchoolId.get(school.id);
              return (
                <tr key={school.id} data-search-row={`${school.name} ${school.status}`}>
                  <td className="px-4 py-2 font-medium text-zinc-900">{school.name}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {school.current_session} · Term {school.current_term}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">{stats?.student_count ?? 0}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">{stats?.staff_count ?? 0}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {stats?.last_activity ? stats.last_activity.slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{school.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        school.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {school.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        school.facilities_enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {school.facilities_enabled ? "enabled" : "disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <SchoolStatusButton schoolId={school.id} status={school.status} />
                      <FacilitiesToggleButton
                        schoolId={school.id}
                        enabled={school.facilities_enabled}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(schools ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-400">
                  No schools yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Recent activity
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          {((logs ?? []) as AdminLogRow[]).length === 0 ? (
            <p className="p-5 text-sm text-zinc-400">No admin actions logged yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {((logs ?? []) as AdminLogRow[]).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-zinc-900">
                    <span className="font-medium">
                      {actorNameById.get(log.actor_id ?? "") ?? "Platform admin"}
                    </span>{" "}
                    {(ACTION_LABELS[log.action] ?? log.action).toLowerCase()}{" "}
                    <span className="font-medium">
                      {schoolNameById.get(log.target_school_id ?? "") ?? "a school"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {new Date(log.created_at).toLocaleString("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BackupHealthCard({ lastBackup }: { lastBackup: BackupRunRow | null }) {
  if (!lastBackup) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Backups</p>
        <p className="mt-2 text-sm text-zinc-400">No backup run has been recorded yet.</p>
      </div>
    );
  }

  const isConfigError = !!lastBackup.config_error;
  const hasFailures = lastBackup.failed_count > 0;
  const status = isConfigError ? "not configured" : hasFailures ? "partial failure" : "healthy";
  const badgeClass = isConfigError
    ? "bg-red-100 text-red-700"
    : hasFailures
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Backups</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{status}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-900">
        Last run {timeAgo(lastBackup.created_at)}
      </p>
      {isConfigError ? (
        <p className="mt-1 text-xs text-red-600">{lastBackup.config_error}</p>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">
          {lastBackup.succeeded_count} of {lastBackup.school_count} school(s) backed up
          {hasFailures ? `, ${lastBackup.failed_count} failed` : ""}
        </p>
      )}
      {lastBackup.failures.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
          {lastBackup.failures.slice(0, 5).map((f) => (
            <li key={f.school_id}>
              {f.school_name}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PURPOSE_LABELS: Record<string, string> = {
  fee_reminder: "Fee reminder",
  staff_notice: "Staff notice",
  broadcast: "Broadcast",
};

function MessageFailuresCard({ rows }: { rows: MessageFailureRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Message failures (24h)
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            rows.length > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">No failed SMS/WhatsApp sends in the last 24 hours.</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
          {rows.slice(0, 20).map((m) => (
            <li key={m.id} className="text-zinc-600">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {m.school_name} · {PURPOSE_LABELS[m.purpose] ?? m.purpose}
                </span>
                <span className="shrink-0 text-zinc-400">{timeAgo(m.created_at)}</span>
              </div>
              {m.error && <p className="truncate text-zinc-400">{m.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StuckPaymentsCard({ rows }: { rows: StuckPaymentRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Stuck payments</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            rows.length > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">No payments stuck pending for over 2 hours.</p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-zinc-600">
              <span className="truncate">
                {p.school_name} · {p.student_name ?? "Unknown student"} · {p.reference}
              </span>
              <span className="shrink-0 text-zinc-400">
                {naira(Number(p.amount))} · {timeAgo(p.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
