/**
 * Annonces vocales de l'écran TV (§5.6) : « Ticket C 47, présentez-vous au cabinet 3 ».
 * Séquence de segments audio préenregistrés (ElevenLabs, scripts/generate-voices.ts) jouée à la suite ;
 * texte complet pour la synthèse vocale du navigateur quand un segment manque.
 * Jamais de nom de client : seulement le numéro du ticket et le poste.
 */
export type AnnouncementLanguage = "fr" | "en";
export type AnnouncedCounterKind = "cabinet" | "guichet" | "caisse" | "laboratoire" | "accueil";

export type AnnouncementInput = {
  code: string;
  counterKind: AnnouncedCounterKind;
  counterNumber: number;
  /** Libellé personnalisé du poste (« Salle bleue ») : annoncé par synthèse vocale. */
  counterLabel?: string | null;
  languages: readonly AnnouncementLanguage[];
  chime: boolean;
};

export const MAX_RECORDED_NUMBER = 999;

const WORDS: Record<AnnouncementLanguage, Record<string, string>> = {
  fr: {
    "word-ticket": "Ticket",
    "please-go-to": "Présentez-vous",
    "to-cabinet": "au cabinet",
    "to-guichet": "au guichet",
    "to-caisse": "à la caisse",
    "to-laboratoire": "au laboratoire",
    "to-accueil": "à l'accueil",
  },
  en: {
    "word-ticket": "Ticket",
    "please-go-to": "Please go to",
    "to-cabinet": "office",
    "to-guichet": "counter",
    "to-caisse": "cashier",
    "to-laboratoire": "laboratory",
    "to-accueil": "reception",
  },
};

/** « C-047 » → { prefix: "C", number: 47 } ; null si le format est inconnu. */
export function parseTicketCode(code: string): { prefix: string; number: number } | null {
  const m = code.match(/^([A-Z]{1,2})-(\d{1,4})$/);
  return m ? { prefix: m[1]!, number: Number(m[2]) } : null;
}

/**
 * Clés des segments à jouer, dans l'ordre (ex. "chime", "fr/word-ticket", "fr/letter-c", "fr/47", …),
 * ou null si l'annonce ne peut pas être composée de segments (libellé libre, numéro > 999).
 */
export function announcementSegments(input: AnnouncementInput): string[] | null {
  const parsed = parseTicketCode(input.code);
  if (!parsed || input.counterLabel || parsed.number > MAX_RECORDED_NUMBER || input.counterNumber > MAX_RECORDED_NUMBER) return null;
  const keys: string[] = input.chime ? ["chime"] : [];
  for (const lang of input.languages) {
    keys.push(
      `${lang}/word-ticket`,
      ...parsed.prefix.split("").map((l) => `${lang}/letter-${l.toLowerCase()}`),
      `${lang}/${parsed.number}`,
      `${lang}/please-go-to`,
      `${lang}/to-${input.counterKind}`,
      `${lang}/${input.counterNumber}`,
    );
  }
  return keys;
}

/** Phrase complète pour la synthèse vocale (repli), dans une langue. */
export function announcementText(lang: AnnouncementLanguage, input: AnnouncementInput): string {
  const parsed = parseTicketCode(input.code);
  const ticket = parsed ? `${parsed.prefix.split("").join(" ")} ${parsed.number}` : input.code;
  const w = WORDS[lang];
  const counter = input.counterLabel ?? `${w[`to-${input.counterKind}`]} ${input.counterNumber}`;
  return lang === "fr"
    ? `${w["word-ticket"]} ${ticket}. ${w["please-go-to"]} ${input.counterLabel ? `: ${counter}` : counter}.`
    : `${w["word-ticket"]} ${ticket}. ${w["please-go-to"]} ${counter}.`;
}

/** Tous les segments à enregistrer, avec le texte prononcé (génération des voix). */
export function voiceSegments(lang: AnnouncementLanguage): { key: string; text: string }[] {
  const out = Object.entries(WORDS[lang]).map(([k, text]) => ({ key: `${lang}/${k}`, text }));
  for (const l of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") out.push({ key: `${lang}/letter-${l.toLowerCase()}`, text: l });
  for (let n = 1; n <= MAX_RECORDED_NUMBER; n++) out.push({ key: `${lang}/${n}`, text: String(n) });
  return out;
}

/** Vrai si l'heure locale de l'agence tombe dans une plage de silence (les plages peuvent passer minuit). */
export function inQuietHours(ranges: readonly { from: string; to: string }[], now: Date, timeZone: string): boolean {
  const hm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);
  return ranges.some(({ from, to }) => (from <= to ? hm >= from && hm < to : hm >= from || hm < to));
}
