"use client";

import { useActionState, useState } from "react";
import {
  generatePaymentLink,
  recordPayment,
  sendFeeReminder,
  setDiscount,
  setFeeAmount,
  type FeeActionState,
  type PaymentLinkState,
} from "../../actions";

const initialState: FeeActionState = {};

function Message({ state }: { state: FeeActionState }) {
  if (state.error)
    return (
      <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
    );
  if (state.success)
    return (
      <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {state.success}
      </p>
    );
  return null;
}

export function SetAmountForm({
  studentId,
  feeTypeId,
  currentAmount,
}: {
  studentId: string;
  feeTypeId: string;
  currentAmount: number;
}) {
  const action = setFeeAmount.bind(null, studentId, feeTypeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <Message state={state} />
      <label className="block text-sm font-medium text-zinc-700">
        Amount expected this term
        <input
          name="amount_expected"
          type="number"
          min={0}
          step="0.01"
          defaultValue={currentAmount || undefined}
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save amount"}
      </button>
    </form>
  );
}

export function SetDiscountForm({
  studentId,
  feeTypeId,
  currentDiscount,
  currentReason,
}: {
  studentId: string;
  feeTypeId: string;
  currentDiscount: number;
  currentReason: string | null;
}) {
  const action = setDiscount.bind(null, studentId, feeTypeId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Message state={state} />
      </div>
      <label className="block text-sm font-medium text-zinc-700">
        Discount / scholarship amount
        <input
          name="discount_amount"
          type="number"
          min={0}
          step="0.01"
          defaultValue={currentDiscount || undefined}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Reason (optional)
        <input
          name="discount_reason"
          defaultValue={currentReason ?? ""}
          placeholder="e.g. Sibling discount, merit scholarship"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Saving…" : "Save discount"}
      </button>
    </form>
  );
}

export function RecordPaymentForm({ studentId }: { studentId: string }) {
  const action = recordPayment.bind(null, studentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Message state={state} />
      </div>
      <p className="text-xs text-zinc-400 sm:col-span-2">
        Enter the total received — it&apos;s applied automatically against whatever this student still
        owes, in the order the fee types are listed below.
      </p>
      <label className="text-sm font-medium text-zinc-700">
        Amount
        <input
          name="amount"
          type="number"
          min={0.01}
          step="0.01"
          required
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Date
        <input
          name="payment_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Method
        <select
          name="method"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="cash">Cash</option>
          <option value="transfer">Transfer</option>
        </select>
      </label>
      <label className="text-sm font-medium text-zinc-700">
        Reference (optional)
        <input
          name="reference_number"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}

const initialPaymentLinkState: PaymentLinkState = {};

export function PaymentLinkButton({
  studentId,
  feeTypeId,
}: {
  studentId: string;
  feeTypeId: string;
}) {
  const action = generatePaymentLink.bind(null, studentId, feeTypeId);
  const [state, formAction, pending] = useActionState(action, initialPaymentLinkState);
  const [copied, setCopied] = useState(false);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the link is still visible to select manually
    }
  }

  return (
    <form action={formAction}>
      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.url ? (
        <div className="space-y-2">
          {state.mocked && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Mock mode — set PAYSTACK_SECRET_KEY to accept real payments.
            </p>
          )}
          <button
            type="button"
            onClick={() => copy(state.url!)}
            className="w-full truncate rounded-md border border-zinc-300 bg-white px-4 py-2 text-left text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            title={state.url}
          >
            {copied ? "Copied!" : "Copy payment link"}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate payment link"}
        </button>
      )}
    </form>
  );
}

export function SendReminderButton({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(sendFeeReminder, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="student_id" value={studentId} />
      <Message state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reminder to parent"}
      </button>
    </form>
  );
}
