import { toCsv, csvResponse } from "./csv";
import { toXlsxBuffer, xlsxResponse, jsonResponse } from "./xlsx";

export type ExportFormat = "csv" | "xlsx" | "json";

export function parseExportFormat(searchParams: URLSearchParams): ExportFormat {
  const format = searchParams.get("format");
  return format === "xlsx" || format === "json" ? format : "csv";
}

export async function exportRows(
  format: ExportFormat,
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  baseFilename: string
): Promise<Response> {
  if (format === "xlsx") {
    const buffer = await toXlsxBuffer(rows, columns);
    return xlsxResponse(buffer, `${baseFilename}.xlsx`);
  }
  if (format === "json") {
    return jsonResponse(rows, `${baseFilename}.json`);
  }
  return csvResponse(toCsv(rows, columns), `${baseFilename}.csv`);
}
