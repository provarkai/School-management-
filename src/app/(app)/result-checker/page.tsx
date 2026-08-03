import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { TERM_LABELS, type Term } from "@/lib/types";
import { naira } from "@/lib/format";
import { GenerateBatchForm } from "./GenerateBatchForm";

function suggestSession(current: string): string {
  const match = current.match(/^(\d{4})\/(\d{4})$/);
  return match ? current : "";
}

export default async function ResultCheckerPage() {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("result_checker_batches")
    .select("id, session, term, quantity, price, note, created_at")
    .eq("school_id", profile.school_id ?? "")
    .order("created_at", { ascending: false });

  const batchIds = (batches ?? []).map((b) => b.id);
  const { data: pins } =
    batchIds.length > 0
      ? await supabase
          .from("result_checker_pins")
          .select("batch_id, used_count")
          .in("batch_id", batchIds)
      : { data: [] };

  const redeemedByBatch = new Map<string, number>();
  for (const p of pins ?? []) {
    if (p.used_count > 0) {
      redeemedByBatch.set(p.batch_id, (redeemedByBatch.get(p.batch_id) ?? 0) + 1);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Result Checker</h1>
        <p className="text-sm text-zinc-500">
          Scratch-card-style PINs for parents to check one result at{" "}
          <span className="font-mono">/check-result</span> without a parent portal account —
          enter the serial, PIN and the student&rsquo;s admission number. A card can be used more
          than once; &ldquo;redeemed&rdquo; below just means it has been used at least once.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Generate a batch</h2>
        <GenerateBatchForm suggestedSession={suggestSession(school?.current_session ?? "")} />
      </section>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Session</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Cards</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Redeemed</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">Price</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">Generated</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(batches ?? []).map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-2 font-medium text-zinc-900">
                  {b.session} · {TERM_LABELS[b.term as Term]}
                </td>
                <td className="px-4 py-2 text-right text-zinc-500">{b.quantity}</td>
                <td className="px-4 py-2 text-right text-zinc-500">
                  {redeemedByBatch.get(b.id) ?? 0}
                </td>
                <td className="px-4 py-2 text-right text-zinc-500">
                  {b.price !== null ? naira(Number(b.price)) : "—"}
                </td>
                <td className="px-4 py-2 text-zinc-500">{b.created_at.slice(0, 10)}</td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={`/result-checker/pdf/${b.id}`}
                    className="font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Download cards →
                  </a>
                </td>
              </tr>
            ))}
            {(batches ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                  No batches generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
