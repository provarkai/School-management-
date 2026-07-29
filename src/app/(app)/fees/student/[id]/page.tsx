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
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, parent_name, parent_phone")
    .eq("id", id)
    .single();

  if (!student) notFound();

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const [{ data: feeTypes }, { data: fees }] = await Promise.all([
    supabase
      .from("fee_types")
      .select("id, name")
      .eq("school_id", profile.school_id ?? "")
      .order("name"),
    supabase
      .from("fee_summary")
      .select("fee_record_id, fee_type_id, amount_expected, amount_paid, balance, status")
      .eq("student_id", id)
      .eq("session", session)
      .eq("term", term),
  ]);

  const feeByType = new Map((fees ?? []).map((f) => [f.fee_type_id, f]));
  const feeRecordIds = (fees ?? []).map((f) => f.fee_record_id);

  const { data: payments } = feeRecordIds.length
    ? await supabase
        .from("fee_payments")
        .select("id, fee_record_id, amount, payment_date, method, reference_number")
        .in("fee_record_id", feeRecordIds)
        .order("payment_date", { ascending: false })
    : { data: [] };

  const feeTypeNameByRecordId = new Map(
    (fees ?? []).map((f) => [f.fee_record_id, feeTypes?.find((t) => t.id === f.fee_type_id)?.name ?? "—"])
  );

  const totals = (fees ?? []).reduce(
    (acc, f) => {
      acc.expected += Number(f.amount_expected);
      acc.paid += Number(f.amount_paid);
      acc.balance += Number(f.balance);
      return acc;
    },
    { expected: 0, paid: 0, balance: 0 }
  );

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
        <SummaryStat label="Expected" value={naira(totals.expected)} />
        <SummaryStat label="Paid" value={naira(totals.paid)} />
        <SummaryStat label="Balance" value={naira(totals.balance)} highlight={totals.balance > 0} />
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Reminder</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Sends one WhatsApp/SMS message listing every outstanding fee type, with a link to pay
          each online.
        </p>
        <SendReminderButton studentId={id} />
      </section>

      {(feeTypes ?? []).length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-400 shadow-sm">
          No fee types set up yet — add one from the Fees page.
        </p>
      ) : (
        (feeTypes ?? []).map((type) => {
          const fee = feeByType.get(type.id);
          return (
            <section key={type.id} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">{type.name}</h2>
                {fee && (
                  <span className="text-xs text-zinc-500">
                    {naira(Number(fee.amount_paid))} / {naira(Number(fee.amount_expected))} — balance{" "}
                    <span className={Number(fee.balance) > 0 ? "font-medium text-red-600" : "font-medium text-emerald-600"}>
                      {naira(Number(fee.balance))}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SetAmountForm
                  studentId={id}
                  feeTypeId={type.id}
                  currentAmount={Number(fee?.amount_expected ?? 0)}
                />
                <RecordPaymentForm studentId={id} feeTypeId={type.id} />
              </div>

              <PaymentLinkButton studentId={id} feeTypeId={type.id} />
            </section>
          );
        })
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Payment history
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Fee type</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Method</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-zinc-900">{p.payment_date}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {feeTypeNameByRecordId.get(p.fee_record_id) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-900">{naira(Number(p.amount))}</td>
                  <td className="px-4 py-2 capitalize text-zinc-500">{p.method}</td>
                  <td className="px-4 py-2 text-zinc-500">{p.reference_number ?? "—"}</td>
                </tr>
              ))}
              {(payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
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
