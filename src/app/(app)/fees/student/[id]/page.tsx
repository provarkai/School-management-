import { notFound } from "next/navigation";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { PaymentLinkButton, RecordPaymentForm, SendReminderButton, SetAmountForm } from "./FeeForms";

export default async function StudentFeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { school } = await requireProprietor();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, parent_name, parent_phone")
    .eq("id", id)
    .single();

  if (!student) notFound();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: fee } = await supabase
    .from("fee_summary")
    .select("fee_record_id, amount_expected, amount_paid, balance, status")
    .eq("student_id", id)
    .eq("session", session)
    .eq("term", term)
    .maybeSingle();

  const { data: payments } = fee
    ? await supabase
        .from("fee_payments")
        .select("id, amount, payment_date, method, reference_number")
        .eq("fee_record_id", fee.fee_record_id)
        .order("payment_date", { ascending: false })
    : { data: [] };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{student.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {session} · Term {term} — Parent: {student.parent_name ?? "—"} (
          {student.parent_phone ?? "no phone on file"})
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryStat label="Expected" value={naira(Number(fee?.amount_expected ?? 0))} />
        <SummaryStat label="Paid" value={naira(Number(fee?.amount_paid ?? 0))} />
        <SummaryStat
          label="Balance"
          value={naira(Number(fee?.balance ?? 0))}
          highlight={Number(fee?.balance ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Fee amount for this term</h2>
          <SetAmountForm studentId={id} currentAmount={Number(fee?.amount_expected ?? 0)} />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Reminder</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Sends a templated WhatsApp/SMS message to the parent with the outstanding
            balance and a link to pay online.
          </p>
          <SendReminderButton studentId={id} />
        </section>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Online payment link</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Generate a Paystack checkout link for this term&apos;s balance — share it any way
          you like. Payments auto-record here once confirmed.
        </p>
        <PaymentLinkButton studentId={id} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Record a payment</h2>
        <RecordPaymentForm studentId={id} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Payment history
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Date</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Method</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-zinc-900">{p.payment_date}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">{naira(Number(p.amount))}</td>
                  <td className="px-4 py-2 capitalize text-zinc-500">{p.method}</td>
                  <td className="px-4 py-2 text-zinc-500">{p.reference_number ?? "—"}</td>
                </tr>
              ))}
              {(payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${highlight ? "text-red-600" : "text-zinc-900"}`}>
        {value}
      </p>
    </div>
  );
}
