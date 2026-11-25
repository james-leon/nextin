import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { qrMatrix } from "@/lib/qr/matrix";
import { PdfLogo } from "./brand";
import { registerFonts } from "./register-fonts";

// Document imprimé (maquette v2 15) : encre bleu nuit sur papier blanc, valeurs fixes (aucun thème).
const NAVY = "#0D2C54";
const TEXT = "#1C2733";
const GREY = "#5B6878";
const LINE = "#DCE3EC";
const SOFT = "#F4F6F9";
const ORANGE = "#B85E0F";
const GREEN = "#0E7A44";

export type InvoiceLine = { label: string; detail?: string; quantity?: number; unit?: string; amount: string };

export type InvoiceContent = {
  number: string;
  title: string;
  /** « by Wintek · Winner Teknology ». */
  brandLine: string;
  state: { text: string; tone: "open" | "paid" | "void" };
  seller: { heading: string; name: string; lines: string[] };
  buyer: { heading: string; name: string; lines: string[] };
  dates: { heading: string; rows: [string, string][] };
  columns: { description: string; quantity: string; unit: string; amount: string };
  lines: InvoiceLine[];
  totals: { label: string; value: string; strong?: boolean }[];
  /** « Arrêtée à la somme de … francs CFA. » */
  words: string;
  /** Facture ouverte : encadré « Payer par Mobile Money » (QR et lien seulement pour qui peut payer). */
  pay: { title: string; scan: string | null; url: string | null; display: string | null; body: string } | null;
  /** « Payée le … · MTN MoMo · réf. … » ou « Facture annulée ». */
  settled: string | null;
  footerLeft: string;
  footerRight: string;
};

const styles = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9.5, lineHeight: 1.45, color: TEXT, paddingTop: 42, paddingBottom: 36, paddingHorizontal: 45 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 24 },
  brandLine: { marginTop: 4, fontSize: 8.5, color: GREY },
  titleBox: { alignItems: "flex-end" },
  title: { fontSize: 30, lineHeight: 1, fontWeight: 800, color: NAVY, letterSpacing: -0.9 },
  number: { marginTop: 5, fontSize: 11, fontWeight: 600, color: NAVY },
  state: { marginTop: 7, fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", borderWidth: 1.4, borderRadius: 5, paddingVertical: 2, paddingHorizontal: 7 },
  parties: { flexDirection: "row", gap: 18, marginTop: 30, paddingTop: 16, borderTopWidth: 1.2, borderTopColor: NAVY },
  col: { flex: 1 },
  label: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: GREY, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700, color: NAVY },
  dateRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  dateLabel: { color: GREY },
  table: { marginTop: 28 },
  headRow: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 0.8, borderBottomColor: LINE },
  th: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: GREY },
  row: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 0.8, borderBottomColor: LINE },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 40, textAlign: "right" },
  cUnit: { width: 90, textAlign: "right" },
  cAmount: { width: 90, textAlign: "right" },
  lineLabel: { fontWeight: 600, color: NAVY },
  lineDetail: { fontSize: 8.5, color: GREY },
  totals: { marginTop: 10, marginLeft: "auto", width: "48%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { color: GREY },
  grand: { borderTopWidth: 1.2, borderTopColor: NAVY, marginTop: 4, paddingTop: 8 },
  grandText: { fontSize: 13, fontWeight: 700, color: NAVY },
  words: { marginTop: 4, textAlign: "right", fontSize: 8.5, fontStyle: "italic", color: GREY },
  pay: { marginTop: "auto", flexDirection: "row", alignItems: "center", gap: 18, backgroundColor: SOFT, borderRadius: 11, padding: 15 },
  qr: { backgroundColor: "#FFFFFF", borderRadius: 6, padding: 5 },
  payTitle: { fontSize: 12, fontWeight: 700, color: NAVY },
  payText: { marginTop: 2, color: GREY },
  payLink: { color: NAVY, fontWeight: 600 },
  settled: { marginTop: "auto", fontSize: 11, fontWeight: 700 },
  legal: { marginTop: 16, paddingTop: 10, borderTopWidth: 0.8, borderTopColor: LINE, flexDirection: "row", justifyContent: "space-between", gap: 16, fontSize: 8, color: GREY },
});

const STATE_COLOR = { open: ORANGE, paid: GREEN, void: GREY } as const;

/** Facture (abonnement, extension de quota ou campagne), rendue à la demande à partir de l'instantané figé en base. */
export function InvoiceDocument(c: InvoiceContent) {
  registerFonts();
  const qr = c.pay?.url ? qrMatrix(c.pay.url, 0) : null;
  return (
    <Document title={`${c.title} ${c.number}`} author="NextIn by Wintek" language="fr">
      <Page size="A4" style={styles.page}>
        <View style={styles.head}>
          <View>
            <PdfLogo height={30} />
            <Text style={styles.brandLine}>{c.brandLine}</Text>
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.number}>{c.number}</Text>
            <Text style={[styles.state, { color: STATE_COLOR[c.state.tone], borderColor: STATE_COLOR[c.state.tone] }]}>{c.state.text}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          {[c.seller, c.buyer].map((p) => (
            <View key={p.heading} style={styles.col}>
              <Text style={styles.label}>{p.heading}</Text>
              <Text style={styles.partyName}>{p.name}</Text>
              {p.lines.map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
            </View>
          ))}
          <View style={styles.col}>
            <Text style={styles.label}>{c.dates.heading}</Text>
            {c.dates.rows.map(([label, value]) => (
              <View key={label} style={styles.dateRow}>
                <Text style={styles.dateLabel}>{label}</Text>
                <Text>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.th, styles.cDesc]}>{c.columns.description}</Text>
            <Text style={[styles.th, styles.cQty]}>{c.columns.quantity}</Text>
            <Text style={[styles.th, styles.cUnit]}>{c.columns.unit}</Text>
            <Text style={[styles.th, styles.cAmount]}>{c.columns.amount}</Text>
          </View>
          {c.lines.map((l, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={styles.cDesc}>
                <Text style={styles.lineLabel}>{l.label}</Text>
                {l.detail ? <Text style={styles.lineDetail}>{l.detail}</Text> : null}
              </View>
              <Text style={styles.cQty}>{l.quantity ?? ""}</Text>
              <Text style={styles.cUnit}>{l.unit ?? ""}</Text>
              <Text style={styles.cAmount}>{l.amount}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {c.totals.map((row) => (
            <View key={row.label} style={row.strong ? [styles.totalRow, styles.grand] : styles.totalRow}>
              <Text style={row.strong ? styles.grandText : styles.totalLabel}>{row.label}</Text>
              <Text style={row.strong ? styles.grandText : undefined}>{row.value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.words}>{c.words}</Text>

        {c.pay ? (
          <View style={styles.pay} wrap={false}>
            {qr ? (
              <View style={styles.qr}>
                <Svg width={74} height={74} viewBox={`0 0 ${qr.size} ${qr.size}`}>
                  <Rect x={0} y={0} width={qr.size} height={qr.size} fill="#FFFFFF" />
                  <Path d={qr.path} fill={NAVY} />
                </Svg>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>{c.pay.title}</Text>
              {c.pay.scan && c.pay.display ? (
                <Text style={styles.payText}>
                  {c.pay.scan} <Text style={styles.payLink}>{c.pay.display}</Text>
                </Text>
              ) : null}
              <Text style={styles.payText}>{c.pay.body}</Text>
            </View>
          </View>
        ) : c.settled ? (
          <Text style={[styles.settled, { color: c.state.tone === "paid" ? GREEN : GREY }]}>{c.settled}</Text>
        ) : null}

        <View style={styles.legal}>
          <Text>{c.footerLeft}</Text>
          <Text>{c.footerRight}</Text>
        </View>
      </Page>
    </Document>
  );
}
