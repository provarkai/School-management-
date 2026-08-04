import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { TERM_LABELS, type Term } from "@/lib/types";
import { nairaPdf as naira } from "@/lib/pdf/currency";
import { SchoolLetterhead, type LetterheadSchool } from "./SchoolLetterhead";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 12,
    borderBottom: "1pt solid #ccc",
    paddingBottom: 8,
  },
  infoItem: { fontSize: 10 },
  infoLabel: { color: "#777", fontSize: 8, textTransform: "uppercase" },
  table: { display: "flex", width: "auto", marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1pt solid #999",
  },
  cellType: { width: "70%", padding: 6, fontSize: 9 },
  cell: { width: "30%", padding: 6, fontSize: 9, textAlign: "right" },
  cellHeader: { fontWeight: 700, fontSize: 9 },
  summary: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTop: "1pt solid #ccc",
    paddingTop: 8,
  },
  summaryBlock: { width: "45%" },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  summaryLineBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 4,
    borderTop: "1pt solid #333",
    fontWeight: 700,
  },
  signature: { marginTop: 56, alignItems: "flex-end" },
  signatureLine: { width: 180, borderTop: "1pt solid #333", paddingTop: 4, textAlign: "center" },
  footer: { marginTop: 40, fontSize: 8, color: "#777", textAlign: "center" },
});

export interface InvoiceFeeLine {
  fee_type_name: string;
  sticker_amount_expected: number;
  discount_amount: number;
  amount_expected: number;
  amount_paid: number;
  balance: number;
}

export interface InvoiceData {
  school: LetterheadSchool;
  student: {
    full_name: string;
    className: string;
  };
  session: string;
  term: Term;
  invoiceNumber: string;
  issueDate: string;
  fees: InvoiceFeeLine[];
}

export function InvoiceDocument({
  school,
  student,
  session,
  term,
  invoiceNumber,
  issueDate,
  fees,
}: InvoiceData) {
  const totals = fees.reduce(
    (acc, f) => {
      acc.sticker += f.sticker_amount_expected;
      acc.discount += f.discount_amount;
      acc.net += f.amount_expected;
      acc.paid += f.amount_paid;
      acc.balance += f.balance;
      return acc;
    },
    { sticker: 0, discount: 0, net: 0, paid: 0, balance: 0 }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolLetterhead school={school} title="Fee Invoice" />

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Student</Text>
            <Text>{student.full_name}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Class</Text>
            <Text>{student.className}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Session / Term</Text>
            <Text>
              {session} — {TERM_LABELS[term]}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Invoice No.</Text>
            <Text>{invoiceNumber}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text>{issueDate}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.cellType, styles.cellHeader]}>Fee type</Text>
            <Text style={[styles.cell, styles.cellHeader]}>Amount</Text>
          </View>
          {fees.map((f) => (
            <View style={styles.tableRow} key={f.fee_type_name}>
              <Text style={styles.cellType}>{f.fee_type_name}</Text>
              <Text style={styles.cell}>{naira(f.sticker_amount_expected)}</Text>
            </View>
          ))}
          {fees.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={{ ...styles.cellType, width: "100%", textAlign: "center", color: "#999" }}>
                No fees have been set for this term
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryBlock}>
            <View style={styles.summaryLine}>
              <Text>Total fees</Text>
              <Text>{naira(totals.sticker)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>Total discount</Text>
              <Text>{naira(totals.discount)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text>Total paid</Text>
              <Text>{naira(totals.paid)}</Text>
            </View>
            <View style={styles.summaryLineBold}>
              <Text>Balance due</Text>
              <Text>{naira(totals.balance)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.signature}>
          <Text style={styles.signatureLine}>Signed by Management</Text>
        </View>

        <Text style={styles.footer}>Generated automatically — please retain for your records.</Text>
      </Page>
    </Document>
  );
}
