import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#666", marginBottom: 12 },
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
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle?: string;
  columns: ReportTableColumn[];
  rows: Record<string, unknown>[];
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
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
