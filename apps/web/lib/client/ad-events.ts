/**
 * Événements publicitaires des pages client et des écrans TV (affichage, clic, « Passer ») : gardés sur l'appareil puis
 * envoyés par lots à `POST /api/ads/events` (idempotent par identifiant). Hors ligne, la file attend le retour du réseau.
 * Clé de file : jeton du ticket, ou `tv:<jeton d'appareil>` pour un écran (envoyé en Bearer, jamais dans le corps).
 */
import type { AdSurface } from "@nextin/shared/ads";
import { uuidV4 } from "@/lib/desk/uuid";

export type AdEventType = "impression" | "click" | "skip" | "visit";
type QueuedEvent = { id: string; creative_id: string; surface: AdSurface; type: AdEventType; at: string };
type Queue = Record<string, QueuedEvent[]>;

const KEY = "nextin.ad-events";
const MAX_PER_TICKET = 200;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function read(): Queue {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Queue) : {};
  } catch {
    return {};
  }
}

function write(q: Queue) {
  try {
    if (Object.keys(q).length) localStorage.setItem(KEY, JSON.stringify(q));
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible (navigation privée) : les événements de cette page sont perdus, sans gêner le client.
  }
}

const TV_PREFIX = "tv:";
export const tvAdKey = (deviceToken: string) => `${TV_PREFIX}${deviceToken}`;

/** Ajoute un événement à la file du ticket (ou de l'écran) et programme l'envoi. */
export function trackAd(key: string, creativeId: string, surface: AdSurface, type: AdEventType) {
  const q = read();
  const list = (q[key] ??= []);
  list.push({ id: uuidV4(), creative_id: creativeId, surface, type, at: new Date().toISOString() });
  if (list.length > MAX_PER_TICKET) list.splice(0, list.length - MAX_PER_TICKET);
  write(q);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("online", () => void flushAdEvents());
    window.addEventListener("pagehide", () => void flushAdEvents(true));
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushAdEvents(), 4000);
}

/** Envoie la file ; les lots acceptés (ou refusés comme invalides) sont retirés, les autres réessayés plus tard. */
export async function flushAdEvents(leaving = false) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const q = read();
  for (const [key, events] of Object.entries(q)) {
    if (!events.length) continue;
    const ids = new Set(events.map((e) => e.id));
    const device = key.startsWith(TV_PREFIX) ? key.slice(TV_PREFIX.length) : null;
    try {
      const res = await fetch("/api/ads/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(device ? { Authorization: `Bearer ${device}` } : {}) },
        body: JSON.stringify(device ? { events } : { ticketToken: key, events }),
        keepalive: leaving,
      });
      // 5xx ou limite atteinte : on garde pour plus tard ; le reste (accepté, ticket terminé, lot invalide) est retiré.
      if (res.status >= 500 || res.status === 429) continue;
    } catch {
      continue;
    }
    const now = read();
    now[key] = (now[key] ?? []).filter((e) => !ids.has(e.id));
    if (!now[key].length) delete now[key];
    write(now);
  }
}
