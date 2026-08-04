import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { nairaPdf as naira } from "@/lib/pdf/currency";
import { TERM_LABELS, type Term } from "@/lib/types";
import type { LetterheadSchool } from "./SchoolLetterhead";

const CARD_W = 252;
const CARD_H = 132;
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 5;
const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

const styles = StyleSheet.create({
  page: { padding: 24, fontFamily: "Helvetica" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: CARD_W,
    height: CARD_H,
    border: "1pt dashed #ccc",
    borderRadius: 6,
    padding: 10,
  },
  schoolName: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 },
  title: {
    fontSize: 6.5,
    color: "#fff",
    backgroundColor: "#18181b",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 3,
    alignSelf: "flex-start",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  codeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  codeLabel: { fontSize: 6, color: "#999", textTransform: "uppercase" },
  codeValue: { fontSize: 11, fontWeight: 700, fontFamily: "Courier", letterSpacing: 0.5 },
  meta: { fontSize: 7, color: "#666", marginTop: 4 },
  instructions: { fontSize: 6.5, color: "#999", marginTop: 6, lineHeight: 1.3 },
});

export interface ResultCheckerCardData {
  serial: string;
  pin: string;
}

export function ResultCheckerCardsDocument({
  cards,
  school,
  session,
  term,
  price,
  checkUrl,
}: {
  cards: ResultCheckerCardData[];
  school: LetterheadSchool;
  session: string;
  term: Term;
  price: number | null;
  checkUrl: string;
}) {
  const pages: ResultCheckerCardData[][] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    pages.push(cards.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <Document>
      {pages.map((pageCards, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <View style={styles.grid}>
            {pageCards.map((card, j) => (
              <View key={j} style={styles.card}>
                <Text style={styles.schoolName}>{school.name}</Text>
                <Text style={styles.title}>Result Checker PIN</Text>
                <View style={styles.codeRow}>
                  <View>
                    <Text style={styles.codeLabel}>Serial</Text>
                    <Text style={styles.codeValue}>{card.serial}</Text>
                  </View>
                  <View>
                    <Text style={styles.codeLabel}>PIN</Text>
                    <Text style={styles.codeValue}>{card.pin}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {session} · {TERM_LABELS[term]}
                  {price !== null ? ` · ${naira(price)}` : ""}
                </Text>
                <Text style={styles.instructions}>
                  Visit {checkUrl} and enter this serial, PIN and your child&apos;s admission
                  number to view their result.
                </Text>
              </View>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  );
}
