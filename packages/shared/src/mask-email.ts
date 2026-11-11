/** Adresse masquée (« d•••@clinique.cm »), identique à `public.mask_email` : jamais l'adresse complète à l'écran. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  return `${email[0]}•••${email.slice(at)}`;
}
