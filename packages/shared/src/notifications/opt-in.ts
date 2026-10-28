/**
 * Opt-in WhatsApp initié par le client (§5.5) : le bouton « Recevoir mes alertes sur WhatsApp » ouvre WhatsApp avec
 * un message prérempli « NEXTIN C-047 7K3Q » (numéro du ticket + 4 derniers caractères du jeton du lien, « EN » en
 * anglais). Sans dépendance : utilisable sur les pages client légères.
 */
export type NotifLocale = "fr" | "en";

export const OPT_IN_KEYWORD = "NEXTIN";
export const TOKEN_SUFFIX_LENGTH = 4;

/** Texte prérempli envoyé par le client. */
export function optInText(code: string, token: string, locale: NotifLocale = "fr"): string {
  return `${OPT_IN_KEYWORD} ${code} ${token.slice(-TOKEN_SUFFIX_LENGTH)}${locale === "en" ? " EN" : ""}`;
}

/** Lien « click to chat » vers le numéro WhatsApp de NextIn (chiffres seulement, sans « + »). */
export function optInLink(whatsappNumber: string, code: string, token: string, locale: NotifLocale = "fr"): string {
  return `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(optInText(code, token, locale))}`;
}

export type InboundMessage =
  | { kind: "opt_in"; code: string; suffix: string; locale: NotifLocale }
  | { kind: "stop" }
  | { kind: "start" }
  | { kind: "other" };

const OPT_IN = /^NEXTIN\s+([A-Z]{1,2})\s*-\s*(\d{3,5})\s+([A-Za-z0-9]{4})(?:\s+(FR|EN))?$/i;
const STOP_WORDS = new Set(["STOP", "ARRET", "ARRÊT", "STOPP", "UNSUBSCRIBE", "DESABONNER", "DÉSABONNER", "STOP ALL"]);
const START_WORDS = new Set(["START", "REPRENDRE", "SUBSCRIBE", "UNSTOP"]);

/** Analyse un message entrant : opt-in, STOP, START ou autre. Le suffixe du jeton garde sa casse. */
export function parseInbound(text: string): InboundMessage {
  const clean = text.trim().replace(/\s+/g, " ");
  const upper = clean.toUpperCase().replace(/[.!]+$/, "");
  if (STOP_WORDS.has(upper)) return { kind: "stop" };
  if (START_WORDS.has(upper)) return { kind: "start" };
  const m = OPT_IN.exec(clean);
  if (m) {
    return { kind: "opt_in", code: `${m[1]!.toUpperCase()}-${m[2]}`, suffix: m[3]!, locale: m[4]?.toLowerCase() === "en" ? "en" : "fr" };
  }
  return { kind: "other" };
}
