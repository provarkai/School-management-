import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { TERM_LABELS, type Term } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: { textAlign: "center", marginBottom: 16 },
  schoolName: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  schoolAddress: { fontSize: 9, color: "#555" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 10, textTransform: "uppercase" },
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
  cellSubject: { width: "40%", padding: 6, fontSize: 9 },
  cell: { width: "15%", padding: 6, fontSize: 9, textAlign: "center" },
  cellHeader: { fontWeight: 700, fontSize: 9 },
  summary: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1pt solid #ccc",
    paddingTop: 8,
  },
  footer: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
  signatureLine: { marginTop: 24, borderTop: "1pt solid #333", width: 160, textAlign: "center", fontSize: 8, paddingTop: 4 },
});

export interface ReportCardData {
  school: {
    name: string;
    address: string | null;
    current_session: string;
  };
  student: {
    full_name: string;
    className: string;
  };
  term: Term;
  results: {
    subject: string;
    ca_score: number;
    exam_score: number;
    total: number;
    grade: string | null;
  }[];
}

function ReportCardPage({ school, student, term, results }: ReportCardData) {
  const totalScore = results.reduce((sum, r) => sum + Number(r.total), 0);
  const average = results.length ? totalScore / results.length : 0;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.schoolName}>{school.name}</Text>
        {school.address && <Text style={styles.schoolAddress}>{school.address}</Text>}
        <Text style={styles.title}>Termly Report Card</Text>
      </View>

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
          <Text style={styles.infoLabel}>Session</Text>
          <Text>{school.current_session}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Term</Text>
          <Text>{TERM_LABELS[term]}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.cellSubject, styles.cellHeader]}>Subject</Text>
          <Text style={[styles.cell, styles.cellHeader]}>CA (40)</Text>
          <Text style={[styles.cell, styles.cellHeader]}>Exam (60)</Text>
          <Text style={[styles.cell, styles.cellHeader]}>Total (100)</Text>
          <Text style={[styles.cell, styles.cellHeader]}>Grade</Text>
        </View>
        {results.map((r) => (
          <View style={styles.tableRow} key={r.subject}>
            <Text style={styles.cellSubject}>{r.subject}</Text>
            <Text style={styles.cell}>{r.ca_score}</Text>
            <Text style={styles.cell}>{r.exam_score}</Text>
            <Text style={styles.cell}>{r.total}</Text>
            <Text style={styles.cell}>{r.grade ?? "—"}</Text>
          </View>
        ))}
        {results.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={{ ...styles.cellSubject, width: "100%", textAlign: "center", color: "#999" }}>
              No scores entered yet
            </Text>
          </View>
        )}
      </View>

      <View style={styles.summary}>
        <Text>Subjects: {results.length}</Text>
        <Text>Total score: {totalScore.toFixed(1)}</Text>
        <Text>Average: {average.toFixed(1)}%</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.signatureLine}>Class Teacher</Text>
        <Text style={styles.signatureLine}>Proprietor</Text>
      </View>
    </Page>
  );
}

export function ReportCardDocument(data: ReportCardData) {
  return (
    <Document>
      <ReportCardPage {...data} />
    </Document>
  );
}

export function BulkReportCardDocument({ cards }: { cards: ReportCardData[] }) {
  return (
    <Document>
      {cards.map((data, i) => (
        <ReportCardPage key={i} {...data} />
      ))}
    </Document>
  );
}
