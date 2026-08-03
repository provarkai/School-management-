import test from "node:test";
import assert from "node:assert/strict";
import { toCsv, safeFilename } from "./csv.ts";

const cols = [
  { key: "name", label: "Student" },
  { key: "amount", label: "Amount" },
];

test("toCsv writes a header row and one line per row, CRLF-separated", () => {
  const csv = toCsv([{ name: "Ada", amount: 5000 }], cols);
  assert.equal(csv, "Student,Amount\r\nAda,5000");
});

test("toCsv quotes fields containing a comma, quote or newline", () => {
  const csv = toCsv([{ name: 'Ada "Grace", Jr.', amount: 1 }], cols);
  assert.match(csv, /"Ada ""Grace"", Jr\."/);
});

test("toCsv renders null and undefined as empty, not the string 'null'", () => {
  const csv = toCsv([{ name: null, amount: undefined }], cols);
  assert.equal(csv, "Student,Amount\r\n,");
});

test("toCsv defuses spreadsheet formulas in untrusted text", () => {
  // A student name, vendor or parent name is free text — typed by staff or
  // arriving through the CSV import — and lands in an export a proprietor
  // opens in Excel.
  for (const attack of [
    '=HYPERLINK("http://evil.example","Click")',
    "+1+1",
    "-1+1",
    "@SUM(A1:A9)",
  ]) {
    const csv = toCsv([{ name: attack, amount: 0 }], cols);
    const cell = csv.split("\r\n")[1];
    assert.ok(
      cell.startsWith("\t") || cell.startsWith('"\t'),
      `expected ${JSON.stringify(attack)} to be prefixed with a tab, got ${JSON.stringify(cell)}`
    );
  }
});

test("toCsv leaves ordinary text untouched", () => {
  const csv = toCsv([{ name: "Chinelo Okafor", amount: 25000 }], cols);
  assert.equal(csv, "Student,Amount\r\nChinelo Okafor,25000");
});

test("toCsv prefixes the school letterhead when one is given", () => {
  const csv = toCsv([{ name: "Ada", amount: 1 }], cols, {
    name: "Sunrise Academy",
    address: "12 Awolowo Road",
    phone: "08030000000",
  });
  assert.deepEqual(csv.split("\r\n").slice(0, 4), [
    "Sunrise Academy",
    "12 Awolowo Road",
    "Tel: 08030000000",
    "",
  ]);
});

test("safeFilename strips characters that would break the Content-Disposition header", () => {
  assert.equal(safeFilename('fees";x="y.csv'), "fees-x-y.csv");
  assert.equal(safeFilename("attendance-JSS 1A-2026-01-01.csv"), "attendance-JSS-1A-2026-01-01.csv");
  assert.equal(safeFilename("report\r\nX-Injected: 1.pdf"), "report-X-Injected-1.pdf");
});

test("safeFilename never returns an empty name", () => {
  assert.equal(safeFilename("///"), "export");
  assert.equal(safeFilename(""), "export");
});
