// Écrans de démarrage iOS (PWA en mode standalone) : `node --experimental-strip-types scripts/generate-startup-images.mjs`.
// Sans `apple-touch-startup-image`, iOS affiche un écran blanc avant le premier rendu (et en thème sombre).
// Fond `bg-grouped` (clair #F2F2F7, sombre #000000) et icône NextIn au centre, à partir de public/brand/nextin-icon.svg.
// La liste est partagée avec app/layout.tsx (lib/pwa/startup-images.ts).
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import { STARTUP_DEVICES, startupFileName } from "../lib/pwa/startup-images.ts";

const OUT = new URL("../public/startup/", import.meta.url);
const icon = await readFile(new URL("../public/brand/nextin-icon.svg", import.meta.url));
const BG = { light: "#F2F2F7", dark: "#000000" };

await mkdir(OUT, { recursive: true });
for (const device of STARTUP_DEVICES) {
  const width = device.width * device.ratio;
  const height = device.height * device.ratio;
  // Icône de 96 points (taille d'une icône d'application agrandie), centrée.
  const size = Math.round(96 * device.ratio);
  const logo = await sharp(icon, { density: 300 }).resize(size, size).png().toBuffer();
  for (const scheme of ["light", "dark"]) {
    const name = startupFileName(device, scheme);
    await sharp({ create: { width, height, channels: 3, background: BG[scheme] } })
      .composite([{ input: logo, left: Math.round((width - size) / 2), top: Math.round((height - size) / 2) }])
      .png({ compressionLevel: 9, palette: true })
      .toFile(new URL(name, OUT).pathname);
    console.log("✓", name);
  }
}
