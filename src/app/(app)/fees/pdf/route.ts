import { renderToBuffer } from "@react-pdf/renderer";
import { requirePermission } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { fetchFeesExportRows, FEES_EXPORT_COLUMNS } from "@/lib/feesExport";
import { ReportTableDocument } from "@/lib/pdf/ReportTableDocument";
import { naira } from "@/lib/format";
import { safeFilename } from "@/lib/csv";

export async function GET(request: Request) {
  const { profile, school } = await requirePermission("fees");
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const classFilter = searchParams.get("class");
  const statusFilter = searchParams.get("status");
  const typeParam = searchParams.get("type");

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const { data: feeTypes } = await supabase
    .from("fee_types")
    .select("id")
    .eq("school_id", profile.school_id ?? "");
  const typeFilter = typeParam === "all" ? null : typeParam || feeTypes?.[0]?.id || null;

  const rows = await fetchFeesExportRows(supabase, profile.school_id ?? "", session, term, {
    classFilter,
    statusFilter,
    typeFilter,
  });

  const formattedRows = rows.map((r) => ({
    ...r,
    amount_expected: r.amount_expected === "" ? "" : naira(Number(r.amount_expected)),
    amount_paid: r.amount_paid === "" ? "" : naira(Number(r.amount_paid)),
    balance: r.balance === "" ? "" : naira(Number(r.balance)),
  }));

  const buffer = await renderToBuffer(
    ReportTableDocument({
      school: {
        name: school?.name ?? "",
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        logo_url: school?.logo_url ?? null,
      },
      title: "Fees",
      subtitle: `${session} — Term ${term}`,
      columns: FEES_EXPORT_COLUMNS,
      rows: formattedRows,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(`fees-${session}-term${term}.pdf`)}"`,
    },
  });
}
