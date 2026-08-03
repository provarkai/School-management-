import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { TERM_LABELS, type Term } from "@/lib/types";
import type { LetterheadSchool } from "./SchoolLetterhead";

// CR80 card size (85.6mm x 54mm, the standard ID/bank-card format) at
// 72pt/in, so a school can cut along the border with an ordinary
// guillotine or scissors and get a card that fits a standard holder.
const CARD_W = 243;
const CARD_H = 153;
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: CARD_W,
    height: CARD_H,
    border: "1pt solid #ccc",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    gap: 8,
  },
  photoBox: {
    width: 62,
    height: 78,
    borderRadius: 3,
    backgroundColor: "#f3f4f6",
    overflow: "hidden",
  },
  photo: { width: 62, height: 78, objectFit: "cover" },
  photoInitial: {
    width: 62,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 700,
    color: "#9ca3af",
  },
  body: { flex: 1, minWidth: 0 },
  schoolRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  logo: { width: 14, height: 14, objectFit: "contain" },
  schoolName: { fontSize: 7, fontWeight: 700, textTransform: "uppercase", flex: 1 },
  cardTitle: {
    fontSize: 6,
    color: "#fff",
    backgroundColor: "#18181b",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 3,
    alignSelf: "flex-start",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  studentName: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  line: { fontSize: 7, color: "#444", marginBottom: 1.5 },
  lineLabel: { color: "#999" },
  footer: {
    position: "absolute",
    bottom: 8,
    left: 10,
    right: 10,
    borderTop: "0.5pt solid #eee",
    paddingTop: 3,
  },
  footerText: { fontSize: 5.5, color: "#999" },
  signatureLine: {
    marginTop: 5,
    borderTop: "0.5pt solid #999",
    width: 70,
    fontSize: 5,
    color: "#999",
    paddingTop: 1.5,
    textAlign: "center",
  },
});

export interface IdCardData {
  fullName: string;
  className: string;
  admissionNumber: string | null;
  photoUrl: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  dateOfBirth: string | null;
  /** First 8 characters of access_token, printed as a verification code a
   * school office can look up if a card is presented out of context. */
  verificationCode: string;
}

function Card({
  student,
  school,
  session,
  term,
}: {
  student: IdCardData;
  school: LetterheadSchool;
  session: string;
  term: Term;
}) {
  const initial = student.fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={styles.card}>
      <View style={styles.photoBox}>
        {student.photoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img
          <Image src={student.photoUrl} style={styles.photo} />
        ) : (
          <Text style={styles.photoInitial}>{initial}</Text>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.schoolRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img */}
          {school.logo_url && <Image src={school.logo_url} style={styles.logo} />}
          <Text style={styles.schoolName}>{school.name}</Text>
        </View>
        <Text style={styles.cardTitle}>Student ID</Text>
        <Text style={styles.studentName}>{student.fullName}</Text>
        <Text style={styles.line}>
          <Text style={styles.lineLabel}>Class: </Text>
          {student.className}
        </Text>
        <Text style={styles.line}>
          <Text style={styles.lineLabel}>Adm. No: </Text>
          {student.admissionNumber ?? "—"}
        </Text>
        {student.dateOfBirth && (
          <Text style={styles.line}>
            <Text style={styles.lineLabel}>DOB: </Text>
            {student.dateOfBirth}
          </Text>
        )}
        {(student.bloodGroup || student.genotype) && (
          <Text style={styles.line}>
            <Text style={styles.lineLabel}>Blood: </Text>
            {student.bloodGroup ?? "—"}
            {student.genotype ? ` · ${student.genotype}` : ""}
          </Text>
        )}
        <Text style={styles.signatureLine}>Signature</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {session} · {TERM_LABELS[term]} · ID {student.verificationCode} · If found, return to
          school office
          {school.phone ? ` (${school.phone})` : ""}.
        </Text>
      </View>
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export function IdCardSheetDocument({
  students,
  school,
  session,
  term,
}: {
  students: IdCardData[];
  school: LetterheadSchool;
  session: string;
  term: Term;
}) {
  const pages = chunk(students, CARDS_PER_PAGE);

  return (
    <Document>
      {pages.map((pageStudents, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageStudents.map((student, j) => (
              <Card key={j} student={student} school={school} session={session} term={term} />
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
