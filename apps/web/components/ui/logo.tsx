import { useId } from "react";
import { cn } from "@/lib/cn";
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
  N_DIAGONAL,
  N_LEFT,
  N_RIGHT,
  QUEUE_BODIES,
  QUEUE_CLIP,
  QUEUE_HEADS,
  WORDMARK_NAME,
  WORDMARK_TAGLINE,
} from "@/lib/brand/logo-data";

/*
 * Marque NextIn « bleu vif » (design/logo). SVG en ligne, sans requête : l'icône arrondie (`LogoMark`) quand la
 * place manque, le logo horizontal « NextIn by Wintek » (`Logo`) sinon. Les couleurs de la marque sont celles du
 * fichier source (identité fixe) ; le mot-symbole suit le thème par jetons (`--logo-name`, `--logo-tagline`).
 */

/** Identifiants uniques par instance (dégradés, découpe) : plusieurs logos peuvent cohabiter sur une page. */
function useSvgIds() {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return { bg: `${base}-bg`, shade: `${base}-sh`, clip: `${base}-cp` };
}

/** Dessin de l'icône (repère 1024 × 1024). */
function IconShapes({ ids }: { ids: ReturnType<typeof useSvgIds> }) {
  return (
    <>
      <defs>
        <linearGradient id={ids.bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRAND_BLUE_TOP} />
          <stop offset="1" stopColor={BRAND_BLUE_BOTTOM} />
        </linearGradient>
        <linearGradient id={ids.shade} gradientUnits="userSpaceOnUse" {...ICON_SHADE}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={BRAND_SHADE_END} />
        </linearGradient>
        <clipPath id={ids.clip}>
          <path d={QUEUE_CLIP} />
        </clipPath>
      </defs>
      <rect width="1024" height="1024" rx={ICON_RADIUS} fill={`url(#${ids.bg})`} />
      <path d={N_DIAGONAL} stroke={`url(#${ids.shade})`} strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" />
      <path d={N_LEFT} stroke="#FFFFFF" strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" />
      <path d={N_RIGHT} stroke="#FFFFFF" strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" />
      {QUEUE_HEADS.map((c) => (
        <circle key={c.cx} {...c} fill="#FFFFFF" />
      ))}
      {QUEUE_BODIES.map((d) => (
        <path key={d} d={d} fill="#FFFFFF" clipPath={`url(#${ids.clip})`} />
      ))}
      <path d={GROUND} fill="#FFFFFF" />
    </>
  );
}

/** Icône seule (arrondie) : barres étroites, en-têtes de formulaire, places réduites. */
export function LogoMark({ className, label }: { className?: string; label?: string }) {
  const ids = useSvgIds();
  return (
    <svg
      viewBox="0 0 1024 1024"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-9 shrink-0", className)}
    >
      <IconShapes ids={ids} />
    </svg>
  );
}

/**
 * Logo horizontal « NextIn by Wintek ». `tone="auto"` : version claire en thème clair, sombre en thème sombre ;
 * `tone="inverse"` : version sombre forcée (panneau bleu nuit, écran TV).
 */
export function Logo({
  className,
  tone = "auto",
  label = "NextIn by Wintek",
}: {
  className?: string;
  tone?: "auto" | "inverse";
  label?: string;
}) {
  const ids = useSvgIds();
  return (
    <svg
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
      role="img"
      aria-label={label}
      data-logo-tone={tone === "inverse" ? "inverse" : undefined}
      className={cn("block h-11 w-auto shrink-0", className)}
    >
      <g transform={`scale(${LOGO_ICON_SCALE})`}>
        <IconShapes ids={ids} />
      </g>
      <path d={WORDMARK_NAME} fill="var(--logo-name)" />
      <path d={WORDMARK_TAGLINE} fill="var(--logo-tagline)" />
    </svg>
  );
}
