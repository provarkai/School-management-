export interface CsvSchoolInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

/**
 * Neutralises spreadsheet formula injection.
 *
 * Excel, LibreOffice and Google Sheets all treat a cell starting with =, +,
 * - or @ as a formula, so a student saved as `=HYPERLINK("http://evil","Click")`
 * — or a vendor name typed into Expenses, or anything arriving through the
 * student/staff CSV import — becomes live code the moment a proprietor
 * opens the export they just downloaded. CSV quoting does not help: the
 * quotes are stripped before the formula is evaluated.
 *
 * Prefixing with a tab is the standard defusal: the spreadsheet stops
 * treating the cell as a formula, and the visible text is unchanged.
 */
function neutralizeFormula(str: string): string {
  return /^[=+\-@\t\r]/.test(str) ? `\t${str}` : str;
}

function escapeCsvField(value: unknown): string {
  const str = neutralizeFormula(value === null || value === undefined ? "" : String(value));
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  school?: CsvSchoolInfo
): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","));
  const preamble = school
    ? [
        escapeCsvField(school.name),
        ...(school.address ? [escapeCsvField(school.address)] : []),
        ...(school.phone ? [escapeCsvField(`Tel: ${school.phone}`)] : []),
        "",
      ]
    : [];
  return [...preamble, header, ...lines].join("\r\n");
}

/**
 * Makes a download filename safe to interpolate into a Content-Disposition
 * header. The names built for these exports embed a class name (staff-typed
 * free text) and date range values taken straight off the query string, so
 * without this a quote or a newline in either one breaks out of the header.
 */
export function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 120) || "export";
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
    },
  });
}
