// Génère les icônes PWA (public/icons) à partir d'un SVG vectoriel : `node scripts/generate-icons.mjs`.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const OUT = new URL("../public/icons/", import.meta.url);

// Marque NextIn (maquette) : tuile bleue Wintek, flèche blanche.
function iconSvg({ size, padding = 0, rounded = true }) {
  const inner = size - padding * 2;
  const r = rounded ? inner * 0.225 : 0;
  const s = inner / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${rounded ? "none" : "#1A6BB5"}"/>
  <g transform="translate(${padding} ${padding})">
    <rect width="${inner}" height="${inner}" rx="${r}" fill="#1A6BB5"/>
    <g transform="scale(${s})" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M30 50h40"/><path d="M52 32l18 18-18 18"/>
    </g>
  </g>
</svg>`;
}

function badgeSvg(size) {
  const s = size / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="scale(${s})" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 50h56"/><path d="M50 24l26 26-26 26"/>
  </g>
</svg>`;
}

await mkdir(OUT, { recursive: true });
const jobs = [
  ["icon-192.png", iconSvg({ size: 192 })],
  ["icon-512.png", iconSvg({ size: 512 })],
  ["icon-maskable-512.png", iconSvg({ size: 512, rounded: false })],
  ["apple-touch-icon.png", iconSvg({ size: 180, rounded: false })],
  ["badge-96.png", badgeSvg(96)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(new URL(name, OUT).pathname);
  console.log("✓", name);
}
