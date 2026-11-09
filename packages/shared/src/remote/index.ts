/**
 * Ticket à distance (M9, §5.3) : « quand partir », distance et trajet. Logique pure, sans Zod (pages client légères).
 * Le calcul du trajet doit rester identique à `public.remote_travel_seconds` (test de parité dans remote.test.ts).
 */

/** Facteur de détour des rues par rapport à la distance à vol d'oiseau. */
export const DETOUR_FACTOR = 1.3;
/** Trajet minimal retenu (secondes). */
export const MIN_TRAVEL_SECONDS = 120;

/** Distance à vol d'oiseau entre deux points (mètres, formule de haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Trajet estimé en ville : distance × 1,3 à `kmh` km/h, 2 minutes au moins (miroir de la fonction SQL). */
export function travelSeconds(distanceM: number, kmh: number): number {
  return Math.max(MIN_TRAVEL_SECONDS, Math.round((distanceM * DETOUR_FACTOR) / ((kmh * 1000) / 3600)));
}

export type LeaveAdvice =
  /** Partir dans `minutes` minutes. */
  | { state: "later"; minutes: number }
  /** Partir maintenant (dans moins d'une minute). */
  | { state: "now" }
  /** L'heure de départ est passée : le client risque d'arriver après son tour. */
  | { state: "late"; minutes: number }
  /** Trajet inconnu : pas de conseil. */
  | { state: "unknown" };

/**
 * « Quand partir » : attente estimée − trajet − marge. Au-delà de 2 minutes de retard, on l'indique
 * (le client doit se presser ou confirmer sa présence au plus vite).
 */
export function leaveAdvice(waitSeconds: number | null, travel: number | null, marginSeconds: number): LeaveAdvice {
  if (waitSeconds == null || travel == null) return { state: "unknown" };
  const slack = waitSeconds - travel - marginSeconds;
  if (slack >= 60) return { state: "later", minutes: Math.floor(slack / 60) };
  if (slack > -120) return { state: "now" };
  return { state: "late", minutes: Math.ceil(-slack / 60) };
}

/** Distance lisible : « 850 m », « 2,4 km », « 12 km ». */
export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

/** Choix proposés pour « Mon trajet » (minutes). */
export const TRAVEL_CHOICES = [10, 20, 30, 45, 60, 90] as const;

/** Lien d'itinéraire (application de cartes du téléphone) vers les coordonnées de l'agence. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
