import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { SchoolLetterhead, type LetterheadSchool } from "./SchoolLetterhead";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  subtitle: { fontSize: 9, color: "#666", marginBottom: 12, textAlign: "center" },
  table: { display: "flex", width: "auto" },
  row: { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  headerRow: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1pt solid #999" },
  cell: { padding: 5, fontSize: 8, flexGrow: 1, flexBasis: 0 },
  cellHeader: { fontWeight: 700 },
});

export interface ReportTableColumn {
  key: string;
  label: string;
}

export function ReportTableDocument({
  school,
  title,
  subtitle,
  columns,
  rows,
}: {
  school: LetterheadSchool;
  title: string;
  subtitle?: string;
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <SchoolLetterhead school={school} title={title} />
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {columns.map((c) => (
              <Text key={c.key} style={[styles.cell, styles.cellHeader]}>
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {columns.map((c) => (
                <Text key={c.key} style={styles.cell}>
                  {String(row[c.key] ?? "")}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
