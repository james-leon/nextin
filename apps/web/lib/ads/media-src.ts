/**
 * Source d'un aperçu publicitaire (image ou vidéo de `AdPreview`) : seulement une adresse locale `blob:` (fichier choisi
 * sur l'appareil, `URL.createObjectURL`) ou un fichier du bucket public `ad-creatives` du projet Supabase. Tout le reste
 * (`javascript:`, `data:`, autre domaine, chemin qui remonte d'un dossier) est refusé : l'aperçu montre alors l'état vide.
 */
export function safeMediaSrc(src: string | null | undefined, supabaseUrl: string | null | undefined): string | null {
  if (!src) return null;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (url.protocol === "blob:") {
    // « blob:https://origine/uuid » : l'origine intérieure doit elle-même être http(s).
    try {
      const inner = new URL(src.slice("blob:".length));
      return inner.protocol === "https:" || inner.protocol === "http:" ? src : null;
    } catch {
      return null;
    }
  }
  if (!supabaseUrl || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  let base: URL;
  try {
    base = new URL(supabaseUrl);
  } catch {
    return null;
  }
  const prefix = `${base.origin}${base.pathname.replace(/\/$/, "")}/storage/v1/object/public/ad-creatives/`;
  // Comparaison sur l'adresse normalisée (`URL` résout les « .. ») : rien hors du bucket.
  return url.href.startsWith(prefix) && url.href.length > prefix.length && url.origin === base.origin ? url.href : null;
}
