import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { qrMatrix } from "@/lib/qr/matrix";
import { registerFonts } from "./register-fonts";

// Couleurs de marque (support imprimé : valeurs fixes, identiques à la maquette 07/08).
const NAVY = "#0D2C54";
const BLUE = "#1A6BB5";
const BLUE_TINT = "#E7F0F9";
const GREY = "#56606F";
const HAIRLINE = "#E3E3E8";
const QR_BG = "#F2F2F7";

export type PosterFormat = "a5" | "a4";

export type PosterContent = {
  format: PosterFormat;
  orgName: string;
  branchName?: string;
  serviceName?: string;
  url: string;
  shortCode: string;
  text: {
    headline: string;
    subtitle: string;
    steps: [string, string, string];
    footer: string;
    secondary: string;
    serviceLine?: string;
  };
};

/** Supports QR à imprimer : chevalet de table A5 (maquette 07) et affiche murale A4 (maquette 08). */
export function QrPosterDocument({ format, orgName, branchName, url, shortCode, text }: PosterContent) {
  registerFonts();
  const k = format === "a4" ? 1.414 : 1; // A4 = A5 × √2
  const s = (v: number) => v * k;
  const qr = qrMatrix(url, 0);
  const qrSide = s(150);
  const frame = s(198);
  const corner = s(30);
  const stroke = s(4);
  const r = s(14);

  const styles = StyleSheet.create({
    page: { fontFamily: "Inter", color: NAVY, paddingHorizontal: s(36), paddingTop: s(format === "a4" ? 34 : 30), paddingBottom: s(26) },
    topBar: { position: "absolute", top: 0, left: 0, right: 0, height: s(6), backgroundColor: BLUE },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    brand: { flexDirection: "row", alignItems: "center" },
    brandName: { fontSize: s(17), fontWeight: 700, marginLeft: s(7) },
    org: { fontSize: s(8.5), fontWeight: 600, letterSpacing: s(1.3), color: GREY, textTransform: "uppercase", maxWidth: s(180), textAlign: "right" },
    headline: { marginTop: s(26), fontSize: s(38), lineHeight: 1.02, fontWeight: 800, letterSpacing: s(-1.3), textAlign: "center" },
    subtitle: { marginTop: s(9), fontSize: s(11.5), color: GREY, textAlign: "center" },
    serviceLine: { marginTop: s(6), fontSize: s(11), fontWeight: 700, color: BLUE, textAlign: "center" },
    qrWrap: { marginTop: s(20), alignItems: "center" },
    steps: { marginTop: s(20), flexDirection: "row", justifyContent: "space-between" },
    step: { width: "31%", alignItems: "center" },
    stepNum: { width: s(22), height: s(22), borderRadius: s(11), backgroundColor: BLUE_TINT, alignItems: "center", justifyContent: "center" },
    stepNumText: { fontSize: s(10.5), fontWeight: 700, color: BLUE },
    stepText: { marginTop: s(6), fontSize: s(10), fontWeight: 700, textAlign: "center", lineHeight: 1.25 },
    footer: { position: "absolute", left: s(36), right: s(36), bottom: s(24), borderTopWidth: 0.75, borderTopColor: HAIRLINE, paddingTop: s(10) },
    footerLine: { fontSize: s(9), color: GREY, textAlign: "center" },
    code: { fontWeight: 700, color: NAVY, letterSpacing: s(1) },
    secondary: { marginTop: s(4), fontSize: s(8), fontStyle: "italic", color: GREY, textAlign: "center" },
  });

  return (
    <Document title={`NextIn — ${orgName}`} author="NextIn by Wintek" creator="NextIn" producer="NextIn">
      <Page size={format.toUpperCase() as "A4" | "A5"} style={styles.page}>
        {format === "a4" ? <View style={styles.topBar} fixed /> : null}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Svg width={s(24)} height={s(24)} viewBox="0 0 24 24">
              <Rect x={0} y={0} width={24} height={24} rx={6} ry={6} fill={BLUE} />
              <Path d="M7 12h10M13 8l4 4-4 4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
            <Text style={styles.brandName}>NextIn</Text>
          </View>
          <Text style={styles.org}>{branchName ? `${orgName} · ${branchName}` : orgName}</Text>
        </View>

        <Text style={styles.headline}>{text.headline}</Text>
        <Text style={styles.subtitle}>{text.subtitle}</Text>
        {text.serviceLine ? <Text style={styles.serviceLine}>{text.serviceLine}</Text> : null}

        <View style={styles.qrWrap}>
          <Svg width={frame} height={frame} viewBox={`0 0 ${frame} ${frame}`}>
            {/* Coins de visée bleus */}
            {[
              `M${stroke / 2} ${corner} V${r} Q${stroke / 2} ${stroke / 2} ${r} ${stroke / 2} H${corner}`,
              `M${frame - corner} ${stroke / 2} H${frame - r} Q${frame - stroke / 2} ${stroke / 2} ${frame - stroke / 2} ${r} V${corner}`,
              `M${stroke / 2} ${frame - corner} V${frame - r} Q${stroke / 2} ${frame - stroke / 2} ${r} ${frame - stroke / 2} H${corner}`,
              `M${frame - corner} ${frame - stroke / 2} H${frame - r} Q${frame - stroke / 2} ${frame - stroke / 2} ${frame - stroke / 2} ${frame - r} V${frame - corner}`,
            ].map((d) => (
              <Path key={d} d={d} stroke={BLUE} strokeWidth={stroke} fill="none" strokeLinecap="butt" />
            ))}
            <Rect x={(frame - qrSide) / 2 - s(10)} y={(frame - qrSide) / 2 - s(10)} width={qrSide + s(20)} height={qrSide + s(20)} rx={s(12)} ry={s(12)} fill="#FFFFFF" stroke={QR_BG} strokeWidth={1} />
          </Svg>
          <View style={{ position: "absolute", top: (frame - qrSide) / 2 }}>
            <Svg width={qrSide} height={qrSide} viewBox={`0 0 ${qr.size} ${qr.size}`}>
              <Path d={qr.path} fill="#000000" />
            </Svg>
          </View>
        </View>

        <View style={styles.steps}>
          {text.steps.map((label, i) => (
            <View key={label} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLine}>
            {text.footer} <Text style={styles.code}>{shortCode}</Text>
          </Text>
          <Text style={styles.secondary}>{text.secondary}</Text>
        </View>
      </Page>
    </Document>
  );
}
