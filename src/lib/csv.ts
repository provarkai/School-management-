export interface CsvSchoolInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
}

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
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

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
