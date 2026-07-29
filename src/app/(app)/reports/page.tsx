import { requireProprietor } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { REPORT_SOURCES, fetchReportRows, type ReportFilters, type ReportSourceKey } from "@/lib/reports";

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  students: [
    { value: "active", label: "Active" },
    { value: "withdrawn", label: "Withdrawn" },
  ],
  fees: [
    { value: "owing", label: "Owing" },
    { value: "partial", label: "Partial" },
    { value: "paid", label: "Paid" },
  ],
  attendance: [
    { value: "present", label: "Present" },
    { value: "absent", label: "Absent" },
    { value: "late", label: "Late" },
  ],
};

function buildQuery(params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return q.toString();
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { profile } = await requireProprietor();
  const supabase = await createClient();
  const schoolId = profile.school_id ?? "";
  const params = await searchParams;

  const sourceKey = (REPORT_SOURCES.some((s) => s.key === params.source) ? params.source : "students") as ReportSourceKey;
  const source = REPORT_SOURCES.find((s) => s.key === sourceKey)!;

  const selectedColumns = params.columns ? params.columns.split(",") : source.columns.map((c) => c.key);
  const ran = params.run === "1";

  const filters: ReportFilters = {
    classId: params.class_id || undefined,
    status: params.status || undefined,
    session: params.session || undefined,
    term: params.term || undefined,
    dateFrom: params.date_from || undefined,
    dateTo: params.date_to || undefined,
    subject: params.subject || undefined,
  };

  const [{ data: classes }, { data: subjectRows }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
    supabase.from("subjects").select("name").eq("school_id", schoolId).order("name"),
  ]);

  const rows = ran ? await fetchReportRows(supabase, schoolId, source.key, filters) : [];
  const activeColumns = source.columns.filter((c) => selectedColumns.includes(c.key));

  const exportParams: Record<string, string> = { source: source.key, columns: selectedColumns.join(",") };
  if (filters.classId) exportParams.class_id = filters.classId;
  if (filters.status) exportParams.status = filters.status;
  if (filters.session) exportParams.session = filters.session;
  if (filters.term) exportParams.term = filters.term;
  if (filters.dateFrom) exportParams.date_from = filters.dateFrom;
  if (filters.dateTo) exportParams.date_to = filters.dateTo;
  if (filters.subject) exportParams.subject = filters.subject;
  const exportQuery = buildQuery(exportParams);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Report builder</h1>
        <p className="text-sm text-zinc-500">
          Pick a data source, choose columns and filters, then run and export the result.
        </p>
      </div>

      <form method="get" className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-zinc-700">
          Data source
          <select
            name="source"
            defaultValue={source.key}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            {REPORT_SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-700">Columns</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {source.columns.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  name="columns"
                  value={c.key}
                  defaultChecked={selectedColumns.includes(c.key)}
                  className="rounded border-zinc-300"
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(source.key === "students" || source.key === "attendance") && (
            <label className="text-sm font-medium text-zinc-700">
              Class
              <select
                name="class_id"
                defaultValue={filters.classId ?? ""}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
              >
                <option value="">All classes</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {STATUS_OPTIONS[source.key] && (
            <label className="text-sm font-medium text-zinc-700">
              Status
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Any status</option>
                {STATUS_OPTIONS[source.key].map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(source.key === "fees" || source.key === "results") && (
            <>
              <label className="text-sm font-medium text-zinc-700">
                Session
                <input
                  name="session"
                  defaultValue={filters.session ?? ""}
                  placeholder="e.g. 2025/2026"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Term
                <select
                  name="term"
                  defaultValue={filters.term ?? ""}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                >
                  <option value="">Any term</option>
                  <option value="1">1st Term</option>
                  <option value="2">2nd Term</option>
                  <option value="3">3rd Term</option>
                </select>
              </label>
            </>
          )}

          {source.key === "results" && (
            <label className="text-sm font-medium text-zinc-700">
              Subject
              <select
                name="subject"
                defaultValue={filters.subject ?? ""}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Any subject</option>
                {(subjectRows ?? []).map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {source.key === "attendance" && (
            <>
              <label className="text-sm font-medium text-zinc-700">
                From date
                <input
                  type="date"
                  name="date_from"
                  defaultValue={filters.dateFrom ?? ""}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                To date
                <input
                  type="date"
                  name="date_to"
                  defaultValue={filters.dateTo ?? ""}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                />
              </label>
            </>
          )}
        </div>

        <input type="hidden" name="run" value="1" />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Run report
        </button>
      </form>

      {ran && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Results ({rows.length})
            </h2>
            <div className="flex gap-2">
              <a
                href={`/reports/export?${exportQuery}&format=csv`}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                Export CSV
              </a>
              <a
                href={`/reports/export?${exportQuery}&format=xlsx`}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                Export Excel
              </a>
              <a
                href={`/reports/export?${exportQuery}&format=json`}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                Export JSON
              </a>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  {activeColumns.map((c) => (
                    <th key={c.key} className="px-4 py-2 text-left font-medium text-zinc-500">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.slice(0, 200).map((row, i) => (
                  <tr key={i}>
                    {activeColumns.map((c) => (
                      <td key={c.key} className="px-4 py-2 text-zinc-900">
                        {String(row[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={activeColumns.length} className="px-4 py-6 text-center text-zinc-400">
                      No rows match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && (
            <p className="text-xs text-zinc-400">
              Showing the first 200 of {rows.length} rows — export to see everything.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
