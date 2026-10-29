/**
 * Images de démo (M10b) générées sans dépendance : PNG RVB encodé à la main (zlib de Node). Visuels publicitaires
 * paysage 16:9 (dégradé, formes douces) et logo rond des pièces de Sky Catch. Aucun fichier binaire dans Git.
 */
import { deflateSync } from "node:zlib";

type Rgb = [number, number, number];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, pixel: (x: number, y: number) => Rgb): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb;

/** Visuel 16:9 : dégradé diagonal entre deux couleurs, disques translucides et bande claire en bas. */
export function bannerPng(from: string, to: string, width = 640, height = 360): Buffer {
  const a = hex(from);
  const b = hex(to);
  const white: Rgb = [255, 255, 255];
  const discs = [
    { x: width * 0.78, y: height * 0.3, r: height * 0.42, alpha: 0.16 },
    { x: width * 0.92, y: height * 0.85, r: height * 0.3, alpha: 0.12 },
    { x: width * 0.12, y: height * 0.1, r: height * 0.22, alpha: 0.1 },
  ];
  return encodePng(width, height, (x, y) => {
    let c = mix(a, b, (x / width) * 0.6 + (y / height) * 0.4);
    for (const d of discs) if ((x - d.x) ** 2 + (y - d.y) ** 2 < d.r ** 2) c = mix(c, white, d.alpha);
    if (y > height * 0.8) c = mix(c, white, 0.12);
    return c;
  });
}

/** Logo rond des pièces (habillage Or) : disque de couleur sur fond doré, 64 × 64. */
export function coinLogoPng(color: string, size = 64): Buffer {
  const c = hex(color);
  const gold: Rgb = [245, 184, 31];
  const r = size / 2;
  return encodePng(size, size, (x, y) => {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
    return d < r * 0.55 ? c : d < r * 0.68 ? [255, 255, 255] : gold;
  });
}

/** Justificatif de visa de démo : PDF minimal d'une page (texte « Visa de démonstration »). */
export function demoVisaPdf(number: string): Buffer {
  const text = `Visa de demonstration ${number}`;
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
