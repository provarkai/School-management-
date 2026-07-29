import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDocument } from "@/lib/pdf/InvoiceDocument";
import type { Term } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("full_name, class_id")
    .eq("id", studentId)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!student || !school) {
    return new Response("Student not found", { status: 404 });
  }

  const { data: klass } = student.class_id
    ? await supabase.from("classes").select("name").eq("id", student.class_id).single()
    : { data: null };

  const session = school.current_session;
  const term = school.current_term as Term;

  const { data: fees } = await supabase
    .from("fee_summary")
    .select("fee_type_name, sticker_amount_expected, discount_amount, amount_expected, amount_paid, balance")
    .eq("student_id", studentId)
    .eq("session", session)
    .eq("term", term)
    .order("fee_type_name");

  const invoiceNumber = `INV-${session.replace(/\D/g, "")}-T${term}-${studentId.slice(0, 8).toUpperCase()}`;

  const buffer = await renderToBuffer(
    InvoiceDocument({
      school: { name: school.name, address: school.address },
      student: { full_name: student.full_name, className: klass?.name ?? "—" },
      session,
      term,
      invoiceNumber,
      issueDate: new Date().toISOString().slice(0, 10),
      fees: (fees ?? []).map((f) => ({
        fee_type_name: f.fee_type_name,
        sticker_amount_expected: Number(f.sticker_amount_expected),
        discount_amount: Number(f.discount_amount),
        amount_expected: Number(f.amount_expected),
        amount_paid: Number(f.amount_paid),
        balance: Number(f.balance),
      })),
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.full_name.replace(/\s+/g, "_")}_invoice.pdf"`,
    },
  });
}
