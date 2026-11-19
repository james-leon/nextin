// Écrans de démarrage iOS (PWA en mode standalone) : `node --experimental-strip-types scripts/generate-startup-images.mjs`.
// Sans `apple-touch-startup-image`, iOS affiche un écran blanc avant le premier rendu (et en thème sombre).
// Rendu par Chromium (Playwright) à partir du filet HTML du gabarit (`lib/pwa/splash.ts`) : même fond, icône, titre
// « NextIn », slogan traduit et trois points (immobiles), en clair et en sombre, en français et en anglais.
// Police Inter (la plus proche de la police système d'Apple disponible ici) ; PNG en palette (fichiers légers).
// La liste des tailles est partagée avec app/layout.tsx (lib/pwa/startup-images.ts).
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { STARTUP_DEVICES, STARTUP_LOCALES, startupFileName } from "../lib/pwa/startup-images.ts";
import { splashCss, splashHtml } from "../lib/pwa/splash.ts";
import { fr } from "../../../packages/shared/src/i18n/fr.ts";
import { en } from "../../../packages/shared/src/i18n/en.ts";

const OUT = new URL("../public/startup/", import.meta.url);
const icon = (await readFile(new URL("../public/brand/nextin-icon.svg", import.meta.url))).toString("base64");
const TEXTS = { fr: fr.common, en: en.common };
// Icône posée tout de suite (pas d'attente d'une seconde) et police d'Apple remplacée par Inter pour le rendu.
const override = `#nx-s{font-family:Inter,sans-serif}#nx-s:before{animation:none;background-image:url(data:image/svg+xml;base64,${icon})}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const device of STARTUP_DEVICES) {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.ratio,
      colorScheme: scheme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const locale of STARTUP_LOCALES) {
      const html = splashHtml(TEXTS[locale].appName, TEXTS[locale].tagline);
      await page.setContent(
        `<!doctype html><html lang="${locale}" data-theme="${scheme}"><head><style>${splashCss}${override}body{margin:0}</style></head>` +
          `<body><div id="nx-s">${html}</div></body></html>`,
      );
      await page.evaluate(() => document.fonts.ready);
      const shot = await page.screenshot({ type: "png" });
      const name = startupFileName(device, scheme, locale);
      await sharp(shot).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(new URL(name, OUT).pathname);
      console.log("✓", name);
    }
    await context.close();
  }
}
await browser.close();
