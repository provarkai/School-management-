import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { nairaPdf as naira } from "@/lib/pdf/currency";
import { TERM_LABELS, type Term } from "@/lib/types";
import { SchoolLetterhead, type LetterheadSchool } from "./SchoolLetterhead";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 12,
    borderBottom: "1pt solid #ccc",
    paddingBottom: 8,
  },
  metaItem: { fontSize: 10 },
  metaLabel: { color: "#777", fontSize: 8, textTransform: "uppercase" },
  amountBox: {
    marginTop: 8,
    padding: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    alignItems: "center",
  },
  amountLabel: { fontSize: 8, color: "#777", textTransform: "uppercase" },
  amount: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "0.5pt solid #eee",
    paddingVertical: 5,
    fontSize: 9,
  },
  sectionTitle: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 4,
  },
  balanceNote: { marginTop: 14, fontSize: 9 },
  footer: { marginTop: 40, fontSize: 8, color: "#777", textAlign: "center" },
  signatureLine: {
    marginTop: 44,
    borderTop: "1pt solid #333",
    width: 180,
    textAlign: "center",
    fontSize: 8,
    paddingTop: 4,
  },
});

export interface ReceiptData {
  school: LetterheadSchool;
  student: { full_name: string; className: string; admissionNumber?: string | null };
  session: string;
  term: Term;
  receiptNumber: string;
  payment: {
    amount: number;
    payment_date: string;
    method: string;
    reference_number: string | null;
    feeTypeName: string;
  };
  /** Position on this fee after the payment, so the receipt answers
   * "what's left?" without the parent having to ask. */
  feeExpected: number;
  feePaidToDate: number;
  feeBalance: number;
  receivedBy: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  transfer: "Bank transfer",
  paystack: "Card / online",
};

export function ReceiptDocument({
  school,
  student,
  session,
  term,
  receiptNumber,
  payment,
  feeExpected,
  feePaidToDate,
  feeBalance,
  receivedBy,
}: ReceiptData) {
  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        <SchoolLetterhead school={school} title="Payment Receipt" />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Receipt No.</Text>
            <Text>{receiptNumber}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text>{payment.payment_date}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Session / Term</Text>
            <Text>
              {session} · {TERM_LABELS[term]}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text>Received from</Text>
          <Text>{student.full_name}</Text>
        </View>
        {student.admissionNumber && (
          <View style={styles.row}>
            <Text>Admission number</Text>
            <Text>{student.admissionNumber}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text>Class</Text>
          <Text>{student.className}</Text>
        </View>
        <View style={styles.row}>
          <Text>Being payment for</Text>
          <Text>{payment.feeTypeName}</Text>
        </View>
        <View style={styles.row}>
          <Text>Method</Text>
          <Text>
            {METHOD_LABELS[payment.method] ?? payment.method}
            {payment.reference_number ? ` · ${payment.reference_number}` : ""}
          </Text>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount received</Text>
          <Text style={styles.amount}>{naira(payment.amount)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Position on this fee</Text>
        <View style={styles.row}>
          <Text>Total expected</Text>
          <Text>{naira(feeExpected)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Paid to date</Text>
          <Text>{naira(feePaidToDate)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Outstanding balance</Text>
          <Text>{naira(feeBalance)}</Text>
        </View>

        <Text style={styles.balanceNote}>
          {feeBalance > 0
            ? `A balance of ${naira(feeBalance)} remains on this fee.`
            : "This fee has been paid in full. Thank you."}
        </Text>

        <Text style={styles.signatureLine}>
          {receivedBy ? `Received by ${receivedBy}` : "Received by"}
        </Text>

        <Text style={styles.footer}>
          This is a computer-generated receipt from {school.name}.
        </Text>
      </Page>
    </Document>
  );
}
