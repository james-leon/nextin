import { Document, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { registerFonts } from "./register-fonts";

// Document imprimé : couleurs fixes (marque Wintek), gabarit sobre façon Apple.
const NAVY = "#0D2C54";
const BLUE = "#1A6BB5";
const GREEN = "#1E7F35";
const GREY = "#56606F";
const HAIRLINE = "#E3E3E8";
const FILL = "#F2F2F7";

export type InvoiceLine = { label: string; quantity?: number; unit?: string; amount: string };

export type InvoiceContent = {
  number: string;
  title: string;
  issued: string;
  due: string;
  period: string;
  periodKind: string;
  seller: { heading: string; lines: string[] };
  buyer: { heading: string; lines: string[] };
  columns: { description: string; quantity: string; unit: string; amount: string };
  lines: InvoiceLine[];
  totals: { label: string; value: string; strong?: boolean }[];
  /** « Payée le … via MTN Mobile Money » ou « Facture annulée ». */
  stamp: { text: string; tone: "paid" | "void" } | null;
  footer: string;
};

const styles = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9.5, color: NAVY, paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontSize: 15, fontWeight: 700 },
  title: { fontSize: 24, fontWeight: 800, textAlign: "right" },
  meta: { color: GREY, textAlign: "right", marginTop: 3 },
  parties: { flexDirection: "row", gap: 24, marginTop: 32 },
  party: { flex: 1, backgroundColor: FILL, borderRadius: 10, padding: 14 },
  partyHeading: { fontSize: 8, fontWeight: 600, color: GREY, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  partyName: { fontWeight: 600, fontSize: 11, marginBottom: 2 },
  partyLine: { color: GREY, marginTop: 1 },
  period: { marginTop: 22, flexDirection: "row", justifyContent: "space-between" },
  periodText: { fontWeight: 600 },
  table: { marginTop: 10, borderTopWidth: 0.5, borderTopColor: HAIRLINE },
  row: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  headRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: HAIRLINE },
  head: { fontSize: 8, fontWeight: 600, color: GREY, textTransform: "uppercase", letterSpacing: 0.4 },
  cDesc: { flex: 1 },
  cQty: { width: 40, textAlign: "right" },
  cUnit: { width: 90, textAlign: "right" },
  cAmount: { width: 100, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalStrong: { fontSize: 13, fontWeight: 800 },
  stampPaid: { marginTop: 20, alignSelf: "flex-start", color: GREEN, borderColor: GREEN, borderWidth: 1, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, fontWeight: 600 },
  stampVoid: { marginTop: 20, alignSelf: "flex-start", color: GREY, borderColor: GREY, borderWidth: 1, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, fontWeight: 600 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 7.5, color: GREY, textAlign: "center" },
});

/** Tuile bleue à flèche blanche (logo NextIn), vectorielle. */
function LogoTile() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M6 0h12a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z" fill={BLUE} />
      <Path d="M7 12h9M12.5 7.5L17 12l-4.5 4.5" stroke="#FFFFFF" strokeWidth={2.2} fill="none" />
    </Svg>
  );
}

/** Facture d'abonnement (§11.6), rendue à la demande à partir de l'instantané figé en base. */
export function InvoiceDocument(c: InvoiceContent) {
  registerFonts();
  return (
    <Document title={`${c.title} ${c.number}`} author="NextIn by Wintek" language="fr">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <LogoTile />
            <Text style={styles.brandName}>NextIn</Text>
          </View>
          <View>
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.meta}>{c.number}</Text>
            <Text style={styles.meta}>{c.issued}</Text>
            <Text style={styles.meta}>{c.due}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          {[c.seller, c.buyer].map((p) => (
            <View key={p.heading} style={styles.party}>
              <Text style={styles.partyHeading}>{p.heading}</Text>
              {p.lines.map((line, i) => (
                <Text key={i} style={i === 0 ? styles.partyName : styles.partyLine}>
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.period}>
          <Text style={styles.periodText}>{c.periodKind}</Text>
          <Text style={{ color: GREY }}>{c.period}</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.head, styles.cDesc]}>{c.columns.description}</Text>
            <Text style={[styles.head, styles.cQty]}>{c.columns.quantity}</Text>
            <Text style={[styles.head, styles.cUnit]}>{c.columns.unit}</Text>
            <Text style={[styles.head, styles.cAmount]}>{c.columns.amount}</Text>
          </View>
          {c.lines.map((l, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Text style={styles.cDesc}>{l.label}</Text>
              <Text style={styles.cQty}>{l.quantity ?? ""}</Text>
              <Text style={styles.cUnit}>{l.unit ?? ""}</Text>
              <Text style={styles.cAmount}>{l.amount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {c.totals.map((row) => (
            <View key={row.label} style={styles.totalRow}>
              <Text style={row.strong ? styles.totalStrong : { color: GREY }}>{row.label}</Text>
              <Text style={row.strong ? styles.totalStrong : undefined}>{row.value}</Text>
            </View>
          ))}
        </View>

        {c.stamp ? <Text style={c.stamp.tone === "paid" ? styles.stampPaid : styles.stampVoid}>{c.stamp.text}</Text> : null}
        {c.footer ? <Text style={styles.footer} fixed>{c.footer}</Text> : null}
      </Page>
    </Document>
  );
}
