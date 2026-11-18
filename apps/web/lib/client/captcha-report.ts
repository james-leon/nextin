/**
 * Journal de diagnostic d'un échec du captcha dans le navigateur (action et code Cloudflare seulement, aucune donnée
 * personnelle) : une ligne dans les journaux du serveur (`/api/diagnostics/captcha`). Envoi sans attente ni erreur.
 * Module chargé à la demande, seulement après un échec (budget des pages client).
 */
export function reportCaptchaFailure(action: string, code: string) {
  try {
    const body = JSON.stringify({ action, code: code.slice(0, 40) });
    if (!navigator.sendBeacon?.("/api/diagnostics/captcha", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/diagnostics/captcha", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Diagnostic seulement : jamais bloquant.
  }
}
