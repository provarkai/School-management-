import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ReceiptDocument } from "@/lib/pdf/ReceiptDocument";
import type { Term } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("fee_payments")
    .select("id, fee_record_id, amount, payment_date, method, reference_number, recorded_by")
    .eq("id", paymentId)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!payment || !school) {
    return new Response("Payment not found", { status: 404 });
  }

  // fee_summary carries the discounted expected amount and the running
  // paid/balance figures, so the receipt reports the same position the
  // fees page shows rather than recomputing it differently.
  const { data: summary } = await supabase
    .from("fee_summary")
    .select(
      "student_id, session, term, fee_type_name, amount_expected, amount_paid, balance"
    )
    .eq("fee_record_id", payment.fee_record_id)
    .single();

  if (!summary) {
    return new Response("Fee record not found", { status: 404 });
  }

  const [{ data: student }, { data: recorder }] = await Promise.all([
    supabase
      .from("students")
      .select("full_name, class_id, admission_number")
      .eq("id", summary.student_id)
      .single(),
    payment.recorded_by
      ? supabase.from("app_users").select("name").eq("id", payment.recorded_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!student) {
    return new Response("Student not found", { status: 404 });
  }

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  // Deterministic and unique without a counter column, matching how invoice
  // numbers are already built.
  const receiptNumber = `RCP-${payment.payment_date.replace(/\D/g, "")}-${payment.id
    .slice(0, 8)
    .toUpperCase()}`;

  const buffer = await renderToBuffer(
    ReceiptDocument({
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        logo_url: school.logo_url,
      },
      student: {
        full_name: student.full_name,
        className: klass?.name ?? "—",
        admissionNumber: student.admission_number,
      },
      session: summary.session,
      term: summary.term as Term,
      receiptNumber,
      payment: {
        amount: Number(payment.amount),
        payment_date: payment.payment_date,
        method: payment.method,
        reference_number: payment.reference_number,
        feeTypeName: summary.fee_type_name,
      },
      feeExpected: Number(summary.amount_expected),
      feePaidToDate: Number(summary.amount_paid),
      feeBalance: Number(summary.balance),
      receivedBy: recorder?.name ?? null,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptNumber}.pdf"`,
    },
  });
}
