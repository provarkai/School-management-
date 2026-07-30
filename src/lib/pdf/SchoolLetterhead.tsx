import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  header: { alignItems: "center", textAlign: "center", marginBottom: 16 },
  logo: { width: 48, height: 48, marginBottom: 6, objectFit: "contain" },
  schoolName: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  schoolAddress: { fontSize: 9, color: "#555" },
  schoolPhone: { fontSize: 9, color: "#555" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 10, textTransform: "uppercase" },
});

export interface LetterheadSchool {
  name: string;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
}

export function SchoolLetterhead({ school, title }: { school: LetterheadSchool; title?: string }) {
  return (
    <View style={styles.header}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img */}
      {school.logo_url && <Image src={school.logo_url} style={styles.logo} />}
      <Text style={styles.schoolName}>{school.name}</Text>
      {school.address && <Text style={styles.schoolAddress}>{school.address}</Text>}
      {school.phone && <Text style={styles.schoolPhone}>Tel: {school.phone}</Text>}
      {title && <Text style={styles.title}>{title}</Text>}
    </View>
  );
}
