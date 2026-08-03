import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { SchoolLetterhead, type LetterheadSchool } from "./SchoolLetterhead";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  certNo: { textAlign: "right", fontSize: 9, color: "#777", marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "0.5pt solid #eee",
    paddingVertical: 6,
    fontSize: 10,
  },
  label: { color: "#666" },
  value: { fontWeight: 700 },
  body: { marginTop: 20, marginBottom: 20, fontSize: 11 },
  sectionTitle: {
    fontSize: 8,
    color: "#777",
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 4,
  },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 56 },
  signatureBlock: { width: 180 },
  signatureLine: { borderTop: "1pt solid #333", paddingTop: 4, fontSize: 9, textAlign: "center" },
  footer: { marginTop: 40, fontSize: 8, color: "#999", textAlign: "center" },
});

export interface TransferCertificateData {
  school: LetterheadSchool;
  certificateNumber: string;
  issuedDate: string;
  student: {
    full_name: string;
    admissionNumber: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    className: string;
  };
  admissionDate: string;
  withdrawnDate: string;
  reason: string | null;
  conductRemark: string | null;
}

export function TransferCertificateDocument({
  school,
  certificateNumber,
  issuedDate,
  student,
  admissionDate,
  withdrawnDate,
  reason,
  conductRemark,
}: TransferCertificateData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.certNo}>Certificate No. {certificateNumber}</Text>
        <SchoolLetterhead school={school} title="Transfer Certificate" />

        <View style={styles.row}>
          <Text style={styles.label}>Student name</Text>
          <Text style={styles.value}>{student.full_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Admission number</Text>
          <Text style={styles.value}>{student.admissionNumber ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date of birth</Text>
          <Text style={styles.value}>{student.dateOfBirth ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Gender</Text>
          <Text style={styles.value}>
            {student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1) : "—"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Last class attended</Text>
          <Text style={styles.value}>{student.className}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date of admission</Text>
          <Text style={styles.value}>{admissionDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date of leaving</Text>
          <Text style={styles.value}>{withdrawnDate}</Text>
        </View>

        <Text style={styles.body}>
          This is to certify that the above-named was a bona fide student of {school.name} from{" "}
          {admissionDate} to {withdrawnDate}, and left the school in the class of{" "}
          {student.className}.
        </Text>

        <Text style={styles.sectionTitle}>Conduct and character</Text>
        <Text style={styles.body}>{conductRemark ?? "Satisfactory."}</Text>

        {reason && (
          <>
            <Text style={styles.sectionTitle}>Reason for leaving</Text>
            <Text style={styles.body}>{reason}</Text>
          </>
        )}

        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Principal / Proprietor&apos;s signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>School stamp</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Issued {issuedDate} by {school.name}
          {school.phone ? ` · ${school.phone}` : ""}.
        </Text>
      </Page>
    </Document>
  );
}
