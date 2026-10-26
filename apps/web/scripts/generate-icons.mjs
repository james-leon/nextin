// Génère les icônes PWA (public/icons) à partir d'un SVG vectoriel : `node scripts/generate-icons.mjs`.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const OUT = new URL("../public/icons/", import.meta.url);

// Monogramme « N » blanc sur Navy Wintek, point orange = « votre tour ».
function iconSvg({ size, padding = 0, rounded = true }) {
  const inner = size - padding * 2;
  const r = rounded ? inner * 0.225 : 0;
  const s = inner / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${rounded ? "none" : "#0D2C54"}"/>
  <g transform="translate(${padding} ${padding})">
    <rect width="${inner}" height="${inner}" rx="${r}" fill="#0D2C54"/>
    <path transform="scale(${s})" d="M30 72V28h9.5l21 28.5V28H70v44h-9.5l-21-28.5V72z" fill="#fff"/>
    <circle cx="${76 * s}" cy="${26 * s}" r="${7 * s}" fill="#F58B1F"/>
  </g>
</svg>`;
}

function badgeSvg(size) {
  const s = size / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <path transform="scale(${s})" d="M22 82V18h14l28 40V18h14v64H64L36 42v40z" fill="#000"/>
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
