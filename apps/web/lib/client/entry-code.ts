/** Code d'entrée d'une agence lu dans un QR code NextIn (…/q/<jeton>) ou saisi (code court de 6 caractères). */
export function entryCodeFromScan(text: string): string | null {
  const m = text.trim().match(/\/q\/([A-Za-z0-9]{6,22})(?:[/?#]|$)/);
  return m ? m[1]! : null;
}

/** Code court saisi : 6 lettres ou chiffres, insensible à la casse et aux espaces. */
export function normalizeShortCode(input: string): string | null {
  const v = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6}$/.test(v) ? v : null;
}
