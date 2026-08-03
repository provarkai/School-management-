import Link from "next/link";
import { requireUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { LEAVE_TYPE_LABELS, type LeaveStatus, type LeaveType } from "@/lib/types";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { CancelLeaveButton } from "./CancelLeaveButton";
import { reviewLeaveRequest } from "./actions";

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};

function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

interface LeaveRow {
  id: string;
  staff_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { profile, isManager } = await requireUser();
  const { status: statusFilter } = await searchParams;
  const supabase = await createClient();

  const { data: myRequests } = await supabase
    .from("leave_requests")
    .select(
      "id, staff_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at, review_note, created_at"
    )
    .eq("staff_id", profile.id)
    .order("created_at", { ascending: false });

  let teamRequests: LeaveRow[] = [];
  let staffNameById = new Map<string, string>();
  let pendingCount = 0;

  if (isManager) {
    let teamQuery = supabase
      .from("leave_requests")
      .select(
        "id, staff_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at, review_note, created_at"
      )
      .eq("school_id", profile.school_id ?? "")
      .neq("staff_id", profile.id)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    if (statusFilter) teamQuery = teamQuery.eq("status", statusFilter);
    const { data } = await teamQuery;
    teamRequests = data ?? [];

    const { count } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("school_id", profile.school_id ?? "")
      .eq("status", "pending");
    pendingCount = count ?? 0;

    const staffIds = Array.from(new Set(teamRequests.map((r) => r.staff_id)));
    if (staffIds.length > 0) {
      const { data: staff } = await supabase
        .from("app_users")
        .select("id, name")
        .in("id", staffIds);
      staffNameById = new Map((staff ?? []).map((s) => [s.id, s.name]));
    }
  }

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status: statusFilter, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/leave?${qs}` : "/leave";
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Leave</h1>
        <p className="text-sm text-zinc-500">
          {isManager
            ? "File your own leave and review requests from the rest of the team."
            : "Request time off and track where each request stands."}
        </p>
      </div>

      <LeaveRequestForm />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          My requests
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Type</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Dates</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Days</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Status</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Note</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(myRequests ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    {LEAVE_TYPE_LABELS[r.leave_type as LeaveType]}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {r.start_date} → {r.end_date}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {dayCount(r.start_date, r.end_date)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status as LeaveStatus]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400">{r.review_note ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {(r.status === "pending" || r.status === "approved") && (
                      <CancelLeaveButton requestId={r.id} />
                    )}
                  </td>
                </tr>
              ))}
              {(myRequests ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    No leave requests filed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isManager && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Team requests
              {pendingCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {pendingCount} pending
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <FilterLink label="All" href={query({ status: undefined })} active={!statusFilter} />
              <FilterLink label="Pending" href={query({ status: "pending" })} active={statusFilter === "pending"} />
              <FilterLink label="Approved" href={query({ status: "approved" })} active={statusFilter === "approved"} />
              <FilterLink label="Rejected" href={query({ status: "rejected" })} active={statusFilter === "rejected"} />
            </div>
          </div>

          <div className="space-y-3">
            {teamRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900">
                      <Link href={`/staff/${r.staff_id}`} className="hover:underline">
                        {staffNameById.get(r.staff_id) ?? "Staff"}
                      </Link>{" "}
                      <span className="font-normal text-zinc-500">
                        — {LEAVE_TYPE_LABELS[r.leave_type]}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-500">
                      {r.start_date} → {r.end_date} ({dayCount(r.start_date, r.end_date)} day
                      {dayCount(r.start_date, r.end_date) === 1 ? "" : "s"})
                    </p>
                    {r.reason && <p className="mt-1 text-sm text-zinc-600">{r.reason}</p>}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.status === "pending" ? (
                  <form action={reviewLeaveRequest.bind(null, r.id, "approved")} className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="flex-1 text-xs font-medium text-zinc-500">
                      Note (optional)
                      <input
                        name="review_note"
                        className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    </label>
                    <button
                      type="submit"
                      formAction={reviewLeaveRequest.bind(null, r.id, "approved")}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      formAction={reviewLeaveRequest.bind(null, r.id, "rejected")}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </form>
                ) : (
                  r.review_note && (
                    <p className="mt-2 text-xs text-zinc-400">Note: {r.review_note}</p>
                  )
                )}
              </div>
            ))}
            {teamRequests.length === 0 && (
              <p className="rounded-lg border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-400 shadow-sm">
                No requests match this filter.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${
        active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {label}
    </Link>
  );
}
