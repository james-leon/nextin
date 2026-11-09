/**
 * Publicité (M10b, §12.4) : rotation pondérée côté appareil (écran TV, pub de l'application). Les poids viennent de
 * la base (`ad_candidates`) ; aucun import lourd (pages client < 200 Ko).
 */

export type AdSurface = "tv" | "app" | "game";

/** Visuel diffusable renvoyé par `ad_candidates_json` / `game_session`. */
export type AdCandidate = {
  campaign_id: string;
  creative_id: string;
  kind: "image" | "video";
  path: string;
  headline: string;
  offer: string | null;
  cta_url: string | null;
  duration: number;
  advertiser: string;
  weight: number;
};

/**
 * Tirage pondéré du visuel suivant, sans répéter `lastId` quand une alternative existe (même règle que
 * `public.ad_weighted_draw`). `rand` : nombre dans [0, 1[.
 */
export function nextAd<T extends { creative_id: string; weight: number }>(candidates: readonly T[], lastId: string | null, rand: number): T | null {
  const pool = candidates.length > 1 ? candidates.filter((c) => c.creative_id !== lastId) : candidates;
  const usable = pool.filter((c) => c.weight > 0);
  if (!usable.length) return null;
  const total = usable.reduce((s, c) => s + c.weight, 0);
  let r = Math.min(Math.max(rand, 0), 0.999999999) * total;
  for (const c of usable) {
    if (r < c.weight) return c;
    r -= c.weight;
  }
  return usable[usable.length - 1]!;
}

/** URL publique d'un fichier du bucket `ad-creatives`. */
export function adFileUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/ad-creatives/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Code de bon lisible : « K7M2-PQ4X ». */
export function formatCouponCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Délai avant « Passer » écoulé ? (`skipAfter` en secondes, réglage de la plateforme). */
export function canSkip(elapsedMs: number, skipAfterSeconds: number): boolean {
  return elapsedMs >= skipAfterSeconds * 1000;
}

/**
 * Interstitielle due entre deux niveaux (ou deux questions) : un visuel disponible et l'espacement minimal respecté
 * depuis la précédente (`minGapSeconds`).
 */
export function interstitialDue(nowMs: number, lastShownMs: number | null, minGapSeconds: number, available: boolean): boolean {
  if (!available) return false;
  return lastShownMs === null || nowMs - lastShownMs >= minGapSeconds * 1000;
}
