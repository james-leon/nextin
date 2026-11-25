import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { qrMatrix } from "@/lib/qr/matrix";
import { PdfLogo } from "./brand";
import { POSTER_COLORS } from "./poster-colors";
import { registerFonts } from "./register-fonts";

export type PosterFormat = "a5" | "a4";

export type PosterContent = {
  format: PosterFormat;
  orgName: string;
  /** « Agence de Makepe » (établissements à plusieurs agences). */
  branchLine?: string;
  url: string;
  /** Domaine affiché pour la saisie du code (« nextin.wintekservices.com »), tiré de `getAppUrl()`. */
  domain: string;
  shortCode: string;
  text: {
    headline: string;
    secondary: string;
    scanTag: string;
    noCamera: string;
    enterCode: string;
    steps: [{ title: string; text: string }, { title: string; text: string }, { title: string; text: string }];
    footerTitle: string;
    footerText: string;
    serviceLine?: string;
  };
};

const { ink: NAVY, ink2: GREY, line: LINE, accent: ORANGE, paper: PAPER } = POSTER_COLORS;
const WIDTH = { a4: 595.28, a5: 419.53 } as const;

/**
 * Affiche QR à imprimer (maquette v2 14), A4 murale ou A5 de table : papier blanc, encre bleu nuit, une seule action
 * (scanner). Établissement et agence en tête, « Prenez votre ticket ici. », QR bleu nuit dans un cadre arrondi marqué
 * « SCANNEZ », domaine et code pour qui n'a pas de caméra, trois étapes numérotées en orange, bandeau bleu nuit avec
 * le logo. Mesures en pourcentage de la largeur de la page (mêmes proportions que la maquette, en A4 comme en A5).
 */
export function QrPosterDocument({ format, orgName, branchLine, url, domain, shortCode, text }: PosterContent) {
  registerFonts();
  const u = WIDTH[format] / 100;
  const qr = qrMatrix(url, 0);
  const qrSide = 31 * u;

  const styles = StyleSheet.create({
    page: { fontFamily: "Inter", color: NAVY, backgroundColor: PAPER },
    top: { paddingTop: 6 * u, paddingHorizontal: 8 * u, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 3 * u },
    org: { fontSize: 4.6 * u, fontWeight: 700, maxWidth: 55 * u },
    branch: { fontSize: 2.6 * u, color: GREY, textAlign: "right", maxWidth: 30 * u },
    mid: { paddingTop: 3 * u, paddingHorizontal: 8 * u, alignItems: "center" },
    headline: { fontSize: 8.4 * u, lineHeight: 1.02, fontWeight: 800, letterSpacing: -0.035 * 8.4 * u, textAlign: "center" },
    secondary: { marginTop: 2 * u, fontSize: 3.2 * u, color: GREY, fontWeight: 500, textAlign: "center" },
    serviceLine: { marginTop: 1.4 * u, fontSize: 3 * u, fontWeight: 700, textAlign: "center" },
    qrBox: { marginTop: 3.6 * u, padding: 2.6 * u, borderWidth: 0.5 * u, borderColor: NAVY, borderRadius: 4.4 * u, alignItems: "center" },
    tagWrap: { position: "absolute", bottom: -1.9 * u, left: 0, right: 0, alignItems: "center" },
    tag: { backgroundColor: PAPER, paddingHorizontal: 2.4 * u, fontSize: 2.6 * u, fontWeight: 700, letterSpacing: 0.14 * 2.6 * u },
    code: { marginTop: 4 * u, fontSize: 3 * u, color: GREY, textAlign: "center", lineHeight: 1.5 },
    domain: { color: NAVY, fontWeight: 700 },
    codeValue: { fontSize: 5.4 * u, color: NAVY, fontWeight: 700, letterSpacing: 0.3 * 5.4 * u },
    steps: { marginTop: 3 * u, borderTopWidth: 0.25 * u, borderTopColor: LINE, paddingTop: 3 * u, flexDirection: "row", gap: 4 * u, width: "100%" },
    step: { flex: 1 },
    stepNum: { fontSize: 4.2 * u, fontWeight: 700, color: ORANGE, lineHeight: 1 },
    stepTitle: { marginTop: 1.4 * u, fontSize: 3 * u, fontWeight: 700, lineHeight: 1.25 },
    stepText: { marginTop: 0.6 * u, fontSize: 2.3 * u, color: GREY, lineHeight: 1.35 },
    foot: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: NAVY, paddingVertical: 3.6 * u, paddingHorizontal: 8 * u, flexDirection: "row", alignItems: "center", gap: 3 * u },
    footText: { flex: 1 },
    footTitle: { fontSize: 2.7 * u, lineHeight: 1.35, color: PAPER, fontWeight: 600 },
    footSub: { fontSize: 2.2 * u, lineHeight: 1.35, color: PAPER, opacity: 0.75 },
  });

  return (
    <Document title={`NextIn — ${orgName}`} author="NextIn by Wintek" creator="NextIn" producer="NextIn" language="fr">
      <Page size={format.toUpperCase() as "A4" | "A5"} style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.org}>{orgName}</Text>
          {branchLine ? <Text style={styles.branch}>{branchLine}</Text> : null}
        </View>
        <View style={styles.mid}>
          <Text style={styles.headline}>{text.headline}</Text>
          <Text style={styles.secondary}>{text.secondary}</Text>
          {text.serviceLine ? <Text style={styles.serviceLine}>{text.serviceLine}</Text> : null}
          <View style={styles.qrBox}>
            <Svg width={qrSide} height={qrSide} viewBox={`0 0 ${qr.size} ${qr.size}`}>
              <Rect x={0} y={0} width={qr.size} height={qr.size} fill={PAPER} />
              <Path d={qr.path} fill={NAVY} />
            </Svg>
            <View style={styles.tagWrap}>
              <Text style={styles.tag}>{text.scanTag.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.code}>
            {text.noCamera} <Text style={styles.domain}>{domain}</Text>
            {"\n"}
            {text.enterCode} <Text style={styles.codeValue}>{shortCode}</Text>
          </Text>
          <View style={styles.steps}>
            {text.steps.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.foot} fixed>
          <View style={styles.footText}>
            <Text style={styles.footTitle}>{text.footerTitle}</Text>
            <Text style={styles.footSub}>{text.footerText}</Text>
          </View>
          <PdfLogo height={6 * u} tone="dark" />
        </View>
      </Page>
    </Document>
  );
}
