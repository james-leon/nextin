/**
 * En-têtes de sécurité des documents (pages, réponses RSC) : politique de sécurité du contenu (CSP), HSTS en HTTPS,
 * isolation de la fenêtre. Calculés à partir de l'environnement au build (Supabase, fond de carte, Turnstile) : aucune
 * URL en dur hors fournisseurs fixes. Pur et testé (`headers.test.ts`).
 *
 * `'unsafe-inline'` pour les scripts : Next.js injecte des scripts en ligne (données RSC) sans nonce tant que les pages
 * ne sont pas toutes rendues dynamiquement ; la politique bloque quand même tout script d'une autre origine, les
 * plug-ins, l'intégration de l'application dans un cadre, les formulaires vers un autre site et toute connexion vers
 * un serveur non prévu (exfiltration). Politique courte : chaque octet compte sur les pages client (budget de 200 Ko) ;
 * polices, service worker et manifeste relèvent de `default-src 'self'`.
 */

const TURNSTILE = "https://challenges.cloudflare.com";

type Env = Record<string, string | undefined>;

/** Origine d'une URL (« https://x.supabase.co »), ou null si l'URL est absente ou invalide. */
function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.replace(/\{[a-z]\}/g, "0")).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(env: Env): string {
  const supabase = origin(env.NEXT_PUBLIC_SUPABASE_URL);
  // Temps réel Supabase : WebSocket sur la même origine (ws en local, wss en production).
  const realtime = supabase ? supabase.replace(/^http/, "ws") : null;
  const tiles = origin(env.NEXT_PUBLIC_MAP_TILES_URL);
  const dev = env.NODE_ENV !== "production";
  const https = (env.APP_URL ?? "").startsWith("https://");
  const list = (...items: (string | null | false)[]) => items.filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    // Développement : le rechargement à chaud de Next.js évalue du code.
    `script-src ${list("'self'", "'unsafe-inline'", dev && "'unsafe-eval'", TURNSTILE)}`,
    "style-src 'self' 'unsafe-inline'",
    // data: et blob: : QR codes générés, recadrage de la photo d'établissement.
    `img-src ${list("'self'", "data:", "blob:", supabase, tiles)}`,
    // Voix des annonces (bucket voices) et vidéos publicitaires (ad-creatives).
    `media-src ${list("'self'", supabase)}`,
    `connect-src ${list("'self'", supabase, realtime)}`,
    `frame-src ${TURNSTILE}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    https && "upgrade-insecure-requests",
  ];
  return directives.filter(Boolean).join("; ");
}

/**
 * En-têtes des documents. HSTS seulement quand l'application est servie en HTTPS. Pas de Referrer-Policy : la valeur
 * par défaut des navigateurs (strict-origin-when-cross-origin) suffit, et les liens personnels (/t, /r, /pay) fixent
 * `no-referrer` dans leur page.
 */
export function documentSecurityHeaders(env: Env): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if ((env.APP_URL ?? "").startsWith("https://")) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
