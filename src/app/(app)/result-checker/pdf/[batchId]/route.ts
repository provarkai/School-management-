import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { ResultCheckerCardsDocument } from "@/lib/pdf/ResultCheckerCardsDocument";
import type { Term } from "@/lib/types";
import { safeFilename } from "@/lib/csv";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("result_checker_batches")
    .select("id, session, term, price")
    .eq("id", batchId)
    .eq("school_id", profile.school_id ?? "")
    .single();

  if (!batch || !school) {
    return new Response("Batch not found", { status: 404 });
  }

  const { data: pins } = await supabase
    .from("result_checker_pins")
    .select("serial, pin")
    .eq("batch_id", batchId)
    .order("created_at");

  if (!pins || pins.length === 0) {
    return new Response("This batch has no cards", { status: 404 });
  }

  const checkUrl = `${new URL(request.url).origin}/check-result`;

  const buffer = await renderToBuffer(
    ResultCheckerCardsDocument({
      cards: pins,
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        logo_url: school.logo_url,
      },
      session: batch.session,
      term: batch.term as Term,
      price: batch.price !== null ? Number(batch.price) : null,
      checkUrl,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFilename(`result-checker-pins-${batch.session}-T${batch.term}.pdf`)}"`,
    },
  });
}
