import localFont from "next/font/local";

/*
 * Polices de SchoolMaster (Wintek) : Inter (texte) et Sora (titres), fichiers de Google Fonts (licence OFL,
 * `app/fonts/OFL-*.txt`) réduits au sous-ensemble latin (français, anglais) et servis par l'application :
 * aucune requête vers Google, ni au build ni au chargement. Pas de préchargement : les pages client
 * (budget < 200 Ko) ne les demandent qu'après le premier affichage (`FontsAfterLoad`).
 */
export const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
  preload: false,
  fallback: ["Arial"],
});

/** Sora : grands titres et titres de section uniquement (graisses 600 à 800). */
export const sora = localFont({
  src: "./fonts/sora-latin-var.woff2",
  weight: "600 800",
  variable: "--font-sora",
  display: "swap",
  preload: false,
  fallback: ["Arial"],
});
