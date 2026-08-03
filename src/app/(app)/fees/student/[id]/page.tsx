import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import {
  PaymentLinkButton,
  RecordPaymentForm,
  SendReminderButton,
  SetAmountForm,
  SetDiscountForm,
} from "./FeeForms";

export default async function StudentFeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, school } = await requirePermission("fees");
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
      .select(
        "fee_record_id, fee_type_id, amount_expected, amount_paid, balance, status, sticker_amount_expected, discount_amount, discount_reason"
      )
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{student.full_name}</h1>
          <p className="text-sm text-zinc-500">
            {session} · Term {term} — Parent: {student.parent_name ?? "—"} (
            {student.parent_phone ?? "no phone on file"})
          </p>
        </div>
        <a
          href={`/fees/invoice/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Download invoice
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryStat label="Expected" value={naira(totals.expected)} />
        <SummaryStat label="Paid" value={naira(totals.paid)} />
        <SummaryStat label="Balance" value={naira(totals.balance)} highlight={totals.balance > 0} />
      </div>

      {(feeTypes ?? []).length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Record payment</h2>
          <RecordPaymentForm studentId={id} />
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Reminder</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Sends one WhatsApp/SMS message listing every outstanding fee type, with a link to pay
          each online.
        </p>
        <SendReminderButton studentId={id} />
      </section>

      {/* One invoice, one card — tuition, PTA, transport, and every other
          fee type are line items on it, not separate invoices. Each row
          expands in place to adjust that line's amount/discount or grab a
          pay-online link; the totals row always matches what the "Download
          invoice" PDF and the combined payment above add up to. */}
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <h2 className="border-b border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900">
          School fees — {session} · Term {term}
        </h2>
        {(feeTypes ?? []).length === 0 ? (
          <p className="p-5 text-sm text-zinc-400">No fee types set up yet — add one from the Fees page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Line item</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Sticker</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Discount</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Net</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Paid</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Balance</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(feeTypes ?? []).map((type) => {
                  const fee = feeByType.get(type.id);
                  const sticker = Number(fee?.sticker_amount_expected ?? 0);
                  const discount = Number(fee?.discount_amount ?? 0);
                  const net = Number(fee?.amount_expected ?? 0);
                  const paid = Number(fee?.amount_paid ?? 0);
                  const balance = Number(fee?.balance ?? 0);
                  return (
                    <tr key={type.id}>
                      <td colSpan={7} className="p-0">
                        <details className="group">
                          <summary className="grid cursor-pointer list-none grid-cols-[1fr_repeat(5,minmax(0,1fr))] items-center gap-2 px-4 py-2 marker:hidden hover:bg-zinc-50">
                            <span className="font-medium text-zinc-900">{type.name}</span>
                            <span className="text-right text-zinc-500">{naira(sticker)}</span>
                            <span className="text-right text-zinc-500">
                              {discount > 0 ? naira(discount) : "—"}
                            </span>
                            <span className="text-right text-zinc-500">{naira(net)}</span>
                            <span className="text-right text-zinc-500">{naira(paid)}</span>
                            <span
                              className={`text-right font-medium ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}
                            >
                              {naira(balance)}
                              <span className="ml-2 text-xs font-normal text-zinc-400 group-open:hidden">
                                Edit ▾
                              </span>
                              <span className="ml-2 hidden text-xs font-normal text-zinc-400 group-open:inline">
                                Close ▴
                              </span>
                            </span>
                          </summary>
                          <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-4 py-4">
                            {fee && discount > 0 && (
                              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Sticker price {naira(sticker)} − discount {naira(discount)}
                                {fee.discount_reason ? ` (${fee.discount_reason})` : ""} = net {naira(net)}
                              </p>
                            )}
                            <SetAmountForm studentId={id} feeTypeId={type.id} currentAmount={sticker} />
                            <SetDiscountForm
                              studentId={id}
                              feeTypeId={type.id}
                              currentDiscount={discount}
                              currentReason={fee?.discount_reason ?? null}
                            />
                            <PaymentLinkButton studentId={id} feeTypeId={type.id} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold text-zinc-900">
                <tr>
                  <td className="px-4 py-2">Total</td>
                  <td />
                  <td />
                  <td className="px-4 py-2 text-right">{naira(totals.expected)}</td>
                  <td className="px-4 py-2 text-right">{naira(totals.paid)}</td>
                  <td className="px-4 py-2 text-right">{naira(totals.balance)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Fee type</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Amount</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Method</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Reference</th>
                <th className="px-4 py-2" />
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
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/fees/receipt/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                    >
                      Receipt
                    </a>
                  </td>
                </tr>
              ))}
              {(payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
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
