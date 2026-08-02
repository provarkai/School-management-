import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { TERM_LABELS, type Term } from "@/lib/types";
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
  remarks: { marginTop: 20 },
  remarkBlock: { marginTop: 10 },
  remarkLabel: { fontSize: 8, color: "#777", textTransform: "uppercase", marginBottom: 2 },
  remarkText: { fontSize: 10, borderBottom: "0.5pt solid #ccc", paddingBottom: 8, minHeight: 16 },
});

export interface ReportCardData {
  school: LetterheadSchool & {
    current_session: string;
    proprietorLabel?: string;
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
  ranking?: { position: number; outOf: number } | null;
  remarks?: { teacher: string | null; principal: string | null } | null;
}

function ReportCardPage({ school, student, term, results, ranking, remarks }: ReportCardData) {
  const totalScore = results.reduce((sum, r) => sum + Number(r.total), 0);
  const average = results.length ? totalScore / results.length : 0;

  return (
    <Page size="A4" style={styles.page}>
      <SchoolLetterhead school={school} title={`${TERM_LABELS[term]} Report Card`} />

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
        <Text>Average: {average.toFixed(1)}%</Text>
        <Text>Position: {ranking ? `${ranking.position} of ${ranking.outOf}` : "—"}</Text>
      </View>

      <View style={styles.remarks}>
        <View style={styles.remarkBlock}>
          <Text style={styles.remarkLabel}>Class Teacher&apos;s Remark</Text>
          <Text style={styles.remarkText}>{remarks?.teacher || "—"}</Text>
        </View>
        <View style={styles.remarkBlock}>
          <Text style={styles.remarkLabel}>{school.proprietorLabel ?? "Proprietor"}&apos;s Remark</Text>
          <Text style={styles.remarkText}>{remarks?.principal || "—"}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.signatureLine}>Class Teacher</Text>
        <Text style={styles.signatureLine}>{school.proprietorLabel ?? "Proprietor"}</Text>
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
