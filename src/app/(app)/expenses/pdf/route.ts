import { renderToBuffer } from "@react-pdf/renderer";
import { requirePermission } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { fetchExpensesExportRows, EXPENSES_EXPORT_COLUMNS } from "@/lib/expensesExport";
import { ReportTableDocument } from "@/lib/pdf/ReportTableDocument";
import { nairaPdf as naira } from "@/lib/pdf/currency";
import { safeFilename } from "@/lib/csv";

export async function GET(request: Request) {
  const { profile, school } = await requirePermission("expenses");
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const categoryFilter = searchParams.get("category");
  const campusFilter = searchParams.get("campus");

  const session = school?.current_session ?? "";
  const term = school?.current_term ?? "1";

  const rows = await fetchExpensesExportRows(supabase, profile.school_id ?? "", session, term, {
    categoryFilter,
    campusFilter,
  });

  const formattedRows = rows.map((r) => ({
    ...r,
    amount: naira(Number(r.amount)),
  }));

  const buffer = await renderToBuffer(
    ReportTableDocument({
      school: {
        name: school?.name ?? "",
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        logo_url: school?.logo_url ?? null,
      },
      title: "Expenses",
      subtitle: `${session} — Term ${term}`,
      columns: EXPENSES_EXPORT_COLUMNS,
      rows: formattedRows,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(`expenses-${session}-term${term}.pdf`)}"`,
    },
  });
}
