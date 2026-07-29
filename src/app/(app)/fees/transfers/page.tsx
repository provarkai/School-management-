import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { LogTransferForm } from "./LogTransferForm";
import { MatchButton, IgnoreButton } from "./MatchButtons";

interface StudentCandidate {
  id: string;
  full_name: string;
  parent_name: string | null;
  balance: number;
}

function suggestCandidates(
  narration: string,
  amount: number,
  students: StudentCandidate[]
): StudentCandidate[] {
  const words = narration
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3);

  const scored = students.map((s) => {
    let score = 0;
    const nameLower = s.full_name.toLowerCase();
    const parentLower = (s.parent_name ?? "").toLowerCase();
    for (const w of words) {
      if (nameLower.includes(w)) score += 2;
      if (parentLower.includes(w)) score += 2;
    }
    if (Math.abs(s.balance - amount) < 0.01) score += 3;
    return { student: s, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.student);
}

export default async function TransfersPage() {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: alerts }, { data: students }, { data: fees }, { data: recent }] = await Promise.all([
    supabase
      .from("bank_transfer_alerts")
      .select("id, amount, narration, transfer_date")
      .eq("school_id", profile.school_id ?? "")
      .eq("status", "unmatched")
      .order("transfer_date", { ascending: false }),
    supabase.from("students").select("id, full_name, parent_name").eq("status", "active"),
    supabase
      .from("fee_summary")
      .select("student_id, balance")
      .eq("school_id", profile.school_id ?? "")
      .eq("session", session)
      .eq("term", term),
    supabase
      .from("bank_transfer_alerts")
      .select("id, amount, narration, transfer_date, status")
      .eq("school_id", profile.school_id ?? "")
      .neq("status", "unmatched")
      .order("transfer_date", { ascending: false })
      .limit(10),
  ]);

  const balanceByStudent = new Map((fees ?? []).map((f) => [f.student_id, Number(f.balance)]));
  const candidates: StudentCandidate[] = (students ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    parent_name: s.parent_name,
    balance: balanceByStudent.get(s.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Bank transfers</h1>
        <p className="text-sm text-zinc-500">
          Paste in transfer alerts as they arrive and match them to a student — most schools
          still collect fees mostly via bank transfer, so this saves re-typing each one as a
          manual payment.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Log a new transfer alert</h2>
        <LogTransferForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Unmatched ({(alerts ?? []).length})
        </h2>
        {(alerts ?? []).map((alert) => {
          const suggestions = suggestCandidates(alert.narration, Number(alert.amount), candidates);
          return (
            <div key={alert.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900">{naira(Number(alert.amount))}</p>
                  <p className="text-sm text-zinc-500">{alert.narration}</p>
                  <p className="text-xs text-zinc-400">{alert.transfer_date}</p>
                </div>
                <IgnoreButton alertId={alert.id} />
              </div>
              {suggestions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm"
                    >
                      <span className="text-zinc-700">
                        {s.full_name}{" "}
                        <span className="text-zinc-400">({naira(s.balance)} owing)</span>
                      </span>
                      <MatchButton alertId={alert.id} studentId={s.id} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">
                  No likely matches found — check the narration or match manually from the
                  student&apos;s fee page.
                </p>
              )}
            </div>
          );
        })}
        {(alerts ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-400">
            No unmatched transfers — log one above as alerts come in.
          </p>
        )}
      </section>

      {(recent ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recently resolved
          </h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <tbody className="divide-y divide-zinc-100">
                {(recent ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-zinc-500">{r.transfer_date}</td>
                    <td className="px-4 py-2 text-zinc-900">{naira(Number(r.amount))}</td>
                    <td className="px-4 py-2 text-zinc-500">{r.narration}</td>
                    <td className="px-4 py-2 capitalize text-zinc-400">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
