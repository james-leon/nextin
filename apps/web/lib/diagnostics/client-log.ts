import { z } from "zod";

/**
 * Journal des erreurs du navigateur (LOT 5a E, diagnostic de l'écran blanc sur iPhone) : `window.onerror`,
 * `unhandledrejection` et navigations en échec du service worker, envoyés à `POST /api/client-log` et écrits dans les
 * journaux du serveur (Vercel → Logs, préfixe `[client-log]`). Jamais de donnée personnelle : ni adresse IP, ni
 * User-Agent complet, ni jeton de ticket ou de demande (masqués), ni adresse e-mail ou numéro de téléphone (masqués) ;
 * rien n'est enregistré en base.
 */
export const CLIENT_LOG_MAX_BYTES = 2048;
/** Messages acceptés par adresse IP (empreinte en mémoire, jamais journalisée) et par minute. */
export const CLIENT_LOG_PER_MINUTE = 10;

export const clientLogSchema = z
  .object({
    kind: z.enum(["error", "rejection", "sw"]),
    message: z.string().max(500),
    source: z.string().max(300).optional(),
    line: z.number().int().nonnegative().max(10_000_000).optional(),
    col: z.number().int().nonnegative().max(10_000_000).optional(),
    path: z.string().max(300).optional(),
    standalone: z.boolean().optional(),
    sw: z.string().max(40).optional(),
  })
  .strict();

export type ClientLog = z.infer<typeof clientLogSchema>;

/** Masque ce qui pourrait identifier quelqu'un : adresses e-mail, numéros (6 chiffres et plus), jetons (20 caractères
 * alphanumériques et plus) et identifiants (UUID). */
export function scrub(text: string): string {
  return text
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "…")
    .replace(/[A-Za-z0-9]{20,}/g, "…")
    .replace(/\+?\d[\d\s.-]{5,}\d/g, "[n]");
}

/** Chemin seul (sans origine ni paramètres), jetons masqués : /t/AbC…(22) → /t/…. */
export function scrubPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let path = value;
  try {
    path = new URL(value, "https://x.invalid").pathname;
  } catch {
    path = value.split(/[?#]/)[0] ?? "";
  }
  return scrub(path).slice(0, 200);
}

/** Ligne de journal, sans donnée personnelle. */
export function clientLogLine(log: ClientLog, device: string): Record<string, unknown> {
  return {
    kind: log.kind,
    message: scrub(log.message).slice(0, 300),
    ...(log.source ? { source: scrubPath(log.source) } : {}),
    ...(log.line !== undefined ? { line: log.line } : {}),
    ...(log.col !== undefined ? { col: log.col } : {}),
    ...(log.path ? { path: scrubPath(log.path) } : {}),
    ...(log.standalone !== undefined ? { standalone: log.standalone } : {}),
    ...(log.sw ? { sw: scrub(log.sw) } : {}),
    device,
  };
}

/** Famille d'appareil seulement (jamais le User-Agent complet) : suffit pour distinguer iOS en mode PWA. */
export function deviceFamily(userAgent: string | null): string {
  if (!userAgent) return "unknown";
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  if (/iPad|Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Firefox/.test(userAgent)) return "ipad-or-mac-safari";
  if (/Android/.test(userAgent)) return "android";
  return "other";
}

/**
 * Limite par adresse IP, en mémoire de l'instance (fenêtre d'une minute) : un navigateur qui boucle sur une erreur ne
 * remplit pas les journaux. L'adresse n'est gardée que sous forme d'empreinte, le temps de la fenêtre.
 */
export function createClientLogLimiter(max = CLIENT_LOG_PER_MINUTE, windowMs = 60_000) {
  const hits = new Map<string, { count: number; until: number }>();
  return (key: string, now = Date.now()): boolean => {
    if (hits.size > 5000) for (const [k, v] of hits) if (v.until <= now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.until <= now) {
      hits.set(key, { count: 1, until: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

/**
 * Script en ligne du gabarit racine (avant tout autre script) : erreurs JavaScript et promesses rejetées, envoyées par
 * `sendBeacon` (cinq au plus par page) ; la dernière est gardée sur l'appareil pour `/debug/pwa`. Quelques centaines
 * d'octets : il part dans chaque page (budget de 200 Ko des pages client).
 */
export const clientErrorScript =
  '(()=>{var n=0;function s(k,m,f,l,c){try{if(n++>4)return;var d={kind:k,message:String(m||"").slice(0,500),path:location.pathname,' +
  'standalone:!!(navigator.standalone||matchMedia("(display-mode: standalone)").matches)};if(f)d.source=String(f).slice(0,300);' +
  'if(l)d.line=l;if(c)d.col=c;try{localStorage.setItem("nextin-last-error",JSON.stringify({at:Date.now(),kind:k,message:d.message,path:d.path}))}catch(e){}' +
  'navigator.sendBeacon&&navigator.sendBeacon("/api/client-log",new Blob([JSON.stringify(d)],{type:"application/json"}))}catch(e){}}' +
  'addEventListener("error",function(e){e.message&&s("error",e.message,e.filename,e.lineno,e.colno)});' +
  'addEventListener("unhandledrejection",function(e){var r=e.reason;s("rejection",r&&r.message||r)})})()';
