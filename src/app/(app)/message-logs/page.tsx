import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_PURPOSE_LABELS, type MessagePurpose, type MessageStatus } from "@/lib/types";
import { TableSearch } from "@/components/TableSearch";
import Link from "next/link";

const PAGE_SIZE = 500;

const STATUS_STYLES: Record<MessageStatus, string> = {
  sent: "bg-emerald-100 text-emerald-700",
  mocked: "bg-zinc-100 text-zinc-500",
  failed: "bg-red-100 text-red-700",
};

export default async function MessageLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string; status?: string }>;
}) {
  const { profile } = await requireProprietor();
  const { purpose: purposeFilter, status: statusFilter } = await searchParams;
  const supabase = await createClient();

  // The most recent PAGE_SIZE matching rows — this is an audit trail
  // someone scrolls, not a report that needs every message ever sent, so
  // it's a bounded query rather than a full read.
  let rowsQuery = supabase
    .from("message_logs")
    .select(
      "id, purpose, recipient_phone, recipient_name, student_id, staff_id, message, status, error, created_at"
    )
    .eq("school_id", profile.school_id ?? "")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (purposeFilter) rowsQuery = rowsQuery.eq("purpose", purposeFilter);
  if (statusFilter) rowsQuery = rowsQuery.eq("status", statusFilter);

  // Counted rather than summed from the page above, so the totals stay
  // accurate even once a school has sent more than PAGE_SIZE messages —
  // always the school's all-time figures, independent of the filters.
  const schoolId = profile.school_id ?? "";
  const [{ data: visible }, { count: sentCount }, { count: mockedCount }, { count: failedCount }] =
    await Promise.all([
      rowsQuery,
      supabase
        .from("message_logs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "sent"),
      supabase
        .from("message_logs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "mocked"),
      supabase
        .from("message_logs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "failed"),
    ]);

  const totals = { sent: sentCount ?? 0, mocked: mockedCount ?? 0, failed: failedCount ?? 0 };
  const rows = visible ?? [];
  const grandTotal = totals.sent + totals.mocked + totals.failed;

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { purpose: purposeFilter, status: statusFilter, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/message-logs?${qs}` : "/message-logs";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Message Delivery Logs</h1>
        <p className="text-sm text-zinc-500">
          Every SMS/WhatsApp attempt this school has sent — fee reminders, staff notices and
          broadcasts — with who it went to and whether it actually went through.
          {grandTotal > PAGE_SIZE &&
            !purposeFilter &&
            !statusFilter &&
            ` Showing the most recent ${PAGE_SIZE} of ${grandTotal}.`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Sent</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{totals.sent}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Mocked</p>
          <p className="mt-1 text-xl font-bold text-zinc-500">{totals.mocked}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Failed</p>
          <p className="mt-1 text-xl font-bold text-red-600">{totals.failed}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FilterLink label="All purposes" href={query({ purpose: undefined })} active={!purposeFilter} />
        {(Object.entries(MESSAGE_PURPOSE_LABELS) as [MessagePurpose, string][]).map(([key, label]) => (
          <FilterLink key={key} label={label} href={query({ purpose: key })} active={purposeFilter === key} />
        ))}
        <span className="mx-1 text-zinc-300">|</span>
        <FilterLink label="Sent" href={query({ status: "sent" })} active={statusFilter === "sent"} />
        <FilterLink label="Failed" href={query({ status: "failed" })} active={statusFilter === "failed"} />
        <FilterLink label="Mocked" href={query({ status: "mocked" })} active={statusFilter === "mocked"} />
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search recipients or message text…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">When</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Recipient</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Purpose</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Message</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  data-search-row={`${r.recipient_name ?? ""} ${r.recipient_phone} ${r.message}`}
                >
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-900">
                    {r.student_id ? (
                      <Link href={`/students/${r.student_id}`} className="hover:underline">
                        {r.recipient_name ?? r.recipient_phone}
                      </Link>
                    ) : (
                      (r.recipient_name ?? r.recipient_phone)
                    )}
                    <span className="block text-xs font-normal text-zinc-400">
                      {r.recipient_phone}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {MESSAGE_PURPOSE_LABELS[r.purpose as MessagePurpose]}
                  </td>
                  <td className="max-w-sm truncate px-4 py-2 text-zinc-500" title={r.message}>
                    {r.message}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status as MessageStatus]}`}
                    >
                      {r.status}
                    </span>
                    {r.error && (
                      <span className="ml-2 text-xs text-red-500" title={r.error}>
                        {r.error.length > 40 ? `${r.error.slice(0, 40)}…` : r.error}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    No messages match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
