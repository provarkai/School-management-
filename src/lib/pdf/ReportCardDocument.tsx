import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { TERM_LABELS, type Term } from "@/lib/types";
import { SchoolLetterhead, type LetterheadSchool } from "./SchoolLetterhead";
import type { ReportCardExtras } from "@/lib/reportCardData";

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
  cellSubject: { padding: 5, fontSize: 8 },
  cell: { padding: 5, fontSize: 8, textAlign: "center" },
  cellHeader: { fontWeight: 700, fontSize: 7.5 },
  cellMuted: { padding: 5, fontSize: 8, textAlign: "center", color: "#666" },
  summary: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1pt solid #ccc",
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 4,
  },
  traitColumns: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  traitColumn: { width: "48%" },
  traitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "0.5pt solid #eee",
    paddingVertical: 2.5,
    fontSize: 8,
  },
  gradeKey: { marginTop: 12, fontSize: 7.5, color: "#666" },
  footer: { marginTop: 28, flexDirection: "row", justifyContent: "space-between" },
  signatureLine: {
    marginTop: 24,
    borderTop: "1pt solid #333",
    width: 160,
    textAlign: "center",
    fontSize: 8,
    paddingTop: 4,
  },
  remarks: { marginTop: 16 },
  remarkBlock: { marginTop: 8 },
  remarkLabel: { fontSize: 8, color: "#777", textTransform: "uppercase", marginBottom: 2 },
  remarkText: { fontSize: 9, borderBottom: "0.5pt solid #ccc", paddingBottom: 7, minHeight: 14 },
});

export interface ReportCardData {
  school: LetterheadSchool & {
    current_session: string;
    proprietorLabel?: string;
  };
  student: {
    full_name: string;
    className: string;
    admissionNumber?: string | null;
  };
  term: Term;
  extras: ReportCardExtras;
  ranking?: { position: number; outOf: number } | null;
  remarks?: { teacher: string | null; principal: string | null } | null;
}

function TraitList({ title, traits }: { title: string; traits: ReportCardExtras["affective"] }) {
  if (traits.length === 0) return null;
  return (
    <View style={styles.traitColumn}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {traits.map((t) => (
        <View style={styles.traitRow} key={t.name}>
          <Text>{t.name}</Text>
          <Text>{t.rating !== null ? `${t.rating}/5` : "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function ReportCardPage({ school, student, term, extras, ranking, remarks }: ReportCardData) {
  const { components, subjects, attendance, affective, psychomotor, gradeKey, nextTermBegins } =
    extras;

  const totalScore = subjects.reduce((sum, r) => sum + r.total, 0);
  const average = subjects.length ? totalScore / subjects.length : 0;

  // The subject column keeps roughly half the width; the rest is split
  // evenly between however many components the school configured, plus
  // total, grade and the class average.
  const scoreColumnCount = components.length + 3;
  const subjectWidth = 34;
  const scoreWidth = `${(100 - subjectWidth) / scoreColumnCount}%`;

  return (
    <Page size="A4" style={styles.page}>
      <SchoolLetterhead school={school} title={`${TERM_LABELS[term]} Report Card`} />

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Student</Text>
          <Text>{student.full_name}</Text>
        </View>
        {student.admissionNumber && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Adm. No.</Text>
            <Text>{student.admissionNumber}</Text>
          </View>
        )}
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
          <Text style={[styles.cellSubject, styles.cellHeader, { width: `${subjectWidth}%` }]}>
            Subject
          </Text>
          {components.map((c) => (
            <Text key={c.id} style={[styles.cell, styles.cellHeader, { width: scoreWidth }]}>
              {c.name} ({Number(c.max_score)})
            </Text>
          ))}
          <Text style={[styles.cell, styles.cellHeader, { width: scoreWidth }]}>Total</Text>
          <Text style={[styles.cell, styles.cellHeader, { width: scoreWidth }]}>Grade</Text>
          <Text style={[styles.cell, styles.cellHeader, { width: scoreWidth }]}>Class Avg</Text>
        </View>

        {subjects.map((r) => (
          <View style={styles.tableRow} key={r.subject}>
            <Text style={[styles.cellSubject, { width: `${subjectWidth}%` }]}>{r.subject}</Text>
            {components.map((c) => (
              <Text key={c.id} style={[styles.cell, { width: scoreWidth }]}>
                {r.componentScores[c.id] !== undefined ? r.componentScores[c.id] : "—"}
              </Text>
            ))}
            <Text style={[styles.cell, { width: scoreWidth }]}>{r.total}</Text>
            <Text style={[styles.cell, { width: scoreWidth }]}>{r.grade ?? "—"}</Text>
            <Text style={[styles.cellMuted, { width: scoreWidth }]}>
              {r.classAverage !== null ? r.classAverage.toFixed(1) : "—"}
            </Text>
          </View>
        ))}

        {subjects.length === 0 && (
          <View style={styles.tableRow}>
            <Text
              style={{ ...styles.cellSubject, width: "100%", textAlign: "center", color: "#999" }}
            >
              No scores entered yet
            </Text>
          </View>
        )}
      </View>

      <View style={styles.summary}>
        <Text>Subjects: {subjects.length}</Text>
        <Text>Average: {average.toFixed(1)}%</Text>
        <Text>Position: {ranking ? `${ranking.position} of ${ranking.outOf}` : "—"}</Text>
        <Text>
          Attendance:{" "}
          {attendance.total > 0
            ? `${attendance.present}/${attendance.total} present`
            : "not recorded"}
        </Text>
      </View>

      {(affective.length > 0 || psychomotor.length > 0) && (
        <View style={styles.traitColumns}>
          <TraitList title="Affective Domain" traits={affective} />
          <TraitList title="Psychomotor Domain" traits={psychomotor} />
        </View>
      )}

      <View style={styles.remarks}>
        <View style={styles.remarkBlock}>
          <Text style={styles.remarkLabel}>Class Teacher&apos;s Remark</Text>
          <Text style={styles.remarkText}>{remarks?.teacher || "—"}</Text>
        </View>
        <View style={styles.remarkBlock}>
          <Text style={styles.remarkLabel}>
            {school.proprietorLabel ?? "Proprietor"}&apos;s Remark
          </Text>
          <Text style={styles.remarkText}>{remarks?.principal || "—"}</Text>
        </View>
      </View>

      {gradeKey.length > 0 && (
        <Text style={styles.gradeKey}>
          Grading:{" "}
          {gradeKey
            .map((b, i) => {
              const upper = i === 0 ? 100 : Number(gradeKey[i - 1].min_score) - 1;
              return `${b.letter} ${Number(b.min_score)}–${upper}`;
            })
            .join("  ·  ")}
        </Text>
      )}

      {nextTermBegins && (
        <Text style={{ marginTop: 6, fontSize: 8 }}>Next term begins: {nextTermBegins}</Text>
      )}

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
