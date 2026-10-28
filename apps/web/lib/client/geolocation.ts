/**
 * Position du client (M9) : demandée seulement quand elle sert (proximité, ticket à distance), jamais envoyée
 * au serveur pour être enregistrée. Les navigateurs exigent
 * `https` (ou localhost) ; la page se replie alors sur le classement par ville.
 */
export type GeoPosition = { lat: number; lng: number };
export type GeoResult = { ok: true; position: GeoPosition } | { ok: false; reason: "denied" | "unavailable" };

export function getPosition(timeoutMs = 10_000): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
    return Promise.resolve({ ok: false, reason: "unavailable" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, position: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (e) => resolve({ ok: false, reason: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: timeoutMs },
    );
  });
}

/** Localisation déjà autorisée (on peut la demander sans afficher d'invite). */
export async function positionGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return status?.state === "granted";
  } catch {
    return false;
  }
}
