import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { TableSearch } from "@/components/TableSearch";

export default async function AuditLogPage() {
  const { profile } = await requireProprietor();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("id, actor_name, actor_role, action, summary, created_at")
    .eq("school_id", profile.school_id ?? "")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Audit log</h1>
        <p className="text-sm text-zinc-500">
          A record of sensitive actions taken across the school — staff changes, payments, leave
          decisions, withdrawals and more — with who did it and when. Showing the most recent 500
          entries.
        </p>
      </div>

      <div data-search-scope className="space-y-3">
        <TableSearch placeholder="Search the log…" />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">When</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Who</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">What happened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(logs ?? []).map((log) => (
                <tr key={log.id} data-search-row={`${log.actor_name} ${log.summary}`}>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-900">
                    {log.actor_name}
                    <span className="ml-1 text-xs capitalize text-zinc-400">({log.actor_role})</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{log.summary}</td>
                </tr>
              ))}
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                    No activity logged yet.
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
