/**
 * Identifiant d'URL à partir d'un nom : minuscules ASCII, tirets, 3 à 48 caractères.
 * « Clinique Sainte-Thérèse d'Akwa » → « clinique-sainte-therese-d-akwa ».
 */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `${base || "org"}-${"x".repeat(Math.max(0, 3 - base.length - 1))}`.slice(0, 48);
}

/** Variante suffixée en cas de collision : « douala-clinic » → « douala-clinic-2 » ou « douala-clinic-k7p4 ». */
export function slugWithSuffix(slug: string, n: number | string): string {
  const suffix = `-${n}`;
  return `${slug.slice(0, 48 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

/** Suffixe aléatoire court (base 36, sans caractère ambigu) pour départager des identifiants. */
export function randomSlugSuffix(length = 4): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Chemin de redirection sûr après connexion : uniquement un chemin interne (« /app », « /invite/… »),
 * jamais une URL absolue ni « //domaine » (redirection ouverte).
 */
export function safeNextPath(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(next, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
