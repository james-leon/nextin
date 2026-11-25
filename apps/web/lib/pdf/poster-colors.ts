/**
 * Couleurs de l'affiche QR (maquette v2 14) : objet imprimé, valeurs fixes (aucun thème). Encre bleu nuit sur papier
 * blanc : le QR code reste lisible par tous les lecteurs (contraste vérifié par `poster.test.ts`).
 */
export const POSTER_COLORS = {
  ink: "#0D2C54",
  ink2: "#4A5B70",
  line: "#DCE3EC",
  accent: "#D9701A",
  paper: "#FFFFFF",
} as const;

/** Luminance relative WCAG d'une couleur « #RRGGBB ». */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Domaine affiché sur l'affiche (« nextin.wintekservices.com ») à partir de l'adresse de l'application. */
export function displayDomain(appUrl: string): string {
  try {
    return new URL(appUrl).host;
  } catch {
    return appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/**
 * Deuxième étape de l'affiche : les trois premiers services suivis de « … » quand il y en a plus (« Consultation,
 * pédiatrie, laboratoire… »), sinon la phrase générique.
 */
export function servicesLine(names: string[], fallback: string): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return fallback;
  const shown = clean.slice(0, 3).map((n, i) => (i === 0 ? n : n.charAt(0).toLocaleLowerCase("fr") + n.slice(1)));
  return clean.length > 3 ? `${shown.join(", ")}…` : `${shown.join(", ")}.`;
}
