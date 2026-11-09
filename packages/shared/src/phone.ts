/**
 * Normalisation des numéros camerounais au format E.164 (+237 6XX XX XX XX ou fixes 2XX).
 * Accepte : "6 77 12 34 56", "677123456", "00237677123456", "+237 677-12-34-56", "237677123456".
 * Renvoie null si le numéro n'est pas un numéro camerounais valide (9 chiffres commençant par 2 ou 6).
 */
export function normalizeCameroonPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("237")) digits = digits.slice(3);
  if (digits.length !== 9 || !/^[26]/.test(digits)) return null;
  return `+237${digits}`;
}

/** Affichage lisible : +237 6 77 12 34 56 */
export function formatCameroonPhone(e164: string): string {
  const local = e164.replace(/^\+237/, "");
  if (local.length !== 9) return e164;
  return `+237 ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/** Masque un numéro pour l'affichage au personnel : +237 6 •• •• •• 56 */
export function maskPhone(e164: string): string {
  const local = e164.replace(/^\+237/, "");
  if (local.length !== 9) return "••••";
  return `+237 ${local[0]} •• •• •• ${local.slice(7, 9)}`;
}
