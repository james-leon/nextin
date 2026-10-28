import path from "node:path";
import { Font } from "@react-pdf/renderer";

const FONT_DIR = path.join(process.cwd(), "lib/pdf/fonts");
let fontsRegistered = false;

/** Police Inter embarquée (supports imprimés, factures). */
export function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "inter-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "inter-latin-400-italic.woff"), fontWeight: 400, fontStyle: "italic" },
      { src: path.join(FONT_DIR, "inter-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "inter-latin-700-normal.woff"), fontWeight: 700 },
      { src: path.join(FONT_DIR, "inter-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  // Pas de césure automatique : les mots restent entiers.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}
