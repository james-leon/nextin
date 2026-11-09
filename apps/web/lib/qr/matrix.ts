import QRCode from "qrcode";

export type QrMatrix = { size: number; path: string };

/**
 * Matrice d'un QR code sous forme de chemin SVG (un carré par module sombre, lignes fusionnées).
 * Niveau de correction Q : le code reste lisible même abîmé ou partiellement masqué (supports imprimés).
 */
export function qrMatrix(text: string, quietZone = 0): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "Q" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const parts: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!data[y * n + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < n && data[y * n + x + run]) run++;
      parts.push(`M${x + quietZone} ${y + quietZone}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return { size: n + quietZone * 2, path: parts.join("") };
}
