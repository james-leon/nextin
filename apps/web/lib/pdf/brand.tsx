import { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop, Svg } from "@react-pdf/renderer";
import {
  BRAND_BLUE_BOTTOM,
  BRAND_BLUE_TOP,
  BRAND_SHADE_END,
  GROUND,
  ICON_RADIUS,
  ICON_SHADE,
  ICON_STROKE,
  LOGO_HEIGHT,
  LOGO_ICON_SCALE,
  LOGO_WIDTH,
  N_DIAGONAL_SHAPE,
  N_LEFT,
  N_RIGHT,
  QUEUE_BODIES,
  QUEUE_CLIP,
  QUEUE_HEADS,
  WORDMARK_LIGHT,
  WORDMARK_NAME,
  WORDMARK_TAGLINE,
} from "@/lib/brand/logo-data";

/*
 * Logo NextIn « bleu vif » dans les PDF (factures, affiche A4, chevalet A5) : même géométrie que le web
 * (`lib/brand/logo-data.ts`), en primitives SVG de @react-pdf/renderer — vectoriel, net à toute échelle.
 * Contraintes du moteur : définitions (`Defs`) directement sous `Svg`, dégradés en remplissage seulement
 * (la diagonale du N est donc une forme pleine). Les PDF sont imprimés sur fond blanc : version claire.
 */

/* Dégradé de la diagonale exprimé dans la boîte de la capsule (x 146–646, y 266–708 dans le repère 1024),
   équivalent au dégradé en coordonnées absolues de la source. */
const shadeX = (x: number) => (x - (214 - ICON_STROKE / 2)) / (578 - 214 + ICON_STROKE);
const shadeY = (y: number) => (y - (334 - ICON_STROKE / 2)) / (640 - 334 + ICON_STROKE);

/** Logo horizontal « NextIn by Wintek » ; `height` en points PDF. */
export function PdfLogo({ height }: { height: number }) {
  return (
    <Svg width={(height * LOGO_WIDTH) / LOGO_HEIGHT} height={height} viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}>
      <Defs>
        {/* Dégradé vertical : x2 = 0 serait remplacé par 1 (valeur nulle prise pour « absente ») — d'où 0,0001. */}
        <LinearGradient id="nx-bg" x1={0} y1={0} x2={0.0001} y2={1}>
          <Stop offset="0" stopColor={BRAND_BLUE_TOP} />
          <Stop offset="1" stopColor={BRAND_BLUE_BOTTOM} />
        </LinearGradient>
        <LinearGradient id="nx-shade" x1={shadeX(ICON_SHADE.x1)} y1={shadeY(ICON_SHADE.y1)} x2={shadeX(ICON_SHADE.x2)} y2={shadeY(ICON_SHADE.y2)}>
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor={BRAND_SHADE_END} />
        </LinearGradient>
        <ClipPath id="nx-queue">
          <Path d={QUEUE_CLIP} />
        </ClipPath>
      </Defs>
      <G transform={`scale(${LOGO_ICON_SCALE})`}>
        <Rect x={0} y={0} width={1024} height={1024} rx={ICON_RADIUS} ry={ICON_RADIUS} fill="url(#nx-bg)" />
        <Path d={N_DIAGONAL_SHAPE} fill="url(#nx-shade)" />
        <Path d={N_LEFT} stroke="#FFFFFF" strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" />
        <Path d={N_RIGHT} stroke="#FFFFFF" strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" />
        {QUEUE_HEADS.map((c) => (
          <Circle key={c.cx} cx={c.cx} cy={c.cy} r={c.r} fill="#FFFFFF" />
        ))}
        {QUEUE_BODIES.map((d) => (
          <Path key={d} d={d} fill="#FFFFFF" clipPath="url(#nx-queue)" />
        ))}
        <Path d={GROUND} fill="#FFFFFF" />
      </G>
      <Path d={WORDMARK_NAME} fill={WORDMARK_LIGHT.name} />
      <Path d={WORDMARK_TAGLINE} fill={WORDMARK_LIGHT.tagline} />
    </Svg>
  );
}
