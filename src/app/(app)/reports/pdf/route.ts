import { renderToBuffer } from "@react-pdf/renderer";
import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getReportSource, fetchReportRows, type ReportFilters } from "@/lib/reports";
import { ReportTableDocument } from "@/lib/pdf/ReportTableDocument";
import { safeFilename } from "@/lib/csv";

export async function GET(request: Request) {
  const { profile, school } = await requireProprietor();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const source = getReportSource(searchParams.get("source") ?? "");
  if (!source) {
    return new Response("Unknown report source", { status: 400 });
  }

  const selectedColumns = searchParams.get("columns")?.split(",") ?? source.columns.map((c) => c.key);
  const activeColumns = source.columns.filter((c) => selectedColumns.includes(c.key));

  const filters: ReportFilters = {
    classId: searchParams.get("class_id") || undefined,
    status: searchParams.get("status") || undefined,
    session: searchParams.get("session") || undefined,
    term: searchParams.get("term") || undefined,
    dateFrom: searchParams.get("date_from") || undefined,
    dateTo: searchParams.get("date_to") || undefined,
    subject: searchParams.get("subject") || undefined,
  };

  const rows = await fetchReportRows(supabase, profile.school_id ?? "", source.key, filters);

  const buffer = await renderToBuffer(
    ReportTableDocument({
      school: {
        name: school?.name ?? "",
        address: school?.address ?? null,
        phone: school?.phone ?? null,
        logo_url: school?.logo_url ?? null,
      },
      title: `${source.label} report`,
      subtitle: new Date().toLocaleDateString("en-NG", { dateStyle: "long" }),
      columns: activeColumns,
      rows,
    })
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(`report_${source.key}.pdf`)}"`,
    },
  });
}
