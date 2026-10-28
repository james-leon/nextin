/**
 * Textes des notifications (§5.5) : modèles WhatsApp à faire approuver par Meta (FR/EN, catégorie Utilité),
 * même texte en message libre dans la fenêtre de 24 h, version courte pour le SMS de secours et le web push.
 * Jamais de nom de client : numéro du ticket, établissement, poste, position et attente uniquement.
 */
import type { NotifLocale } from "./opt-in";

export const NOTIF_EVENTS = [
  "ticket_confirmed",
  "almost_your_turn",
  "your_turn",
  "ticket_moved_back",
  "practitioner_rerouted",
  "practitioner_late",
] as const;
export type NotifEvent = (typeof NOTIF_EVENTS)[number];
export type NotifChannel = "whatsapp" | "push" | "sms";

/** Données d'un message, calculées au moment de l'envoi. */
export type NotificationData = {
  /** « C-047 ». */
  code: string;
  /** « DOUALA CLINIC – Akwa ». */
  place: string;
  /** Personnes devant (null si le ticket n'est plus en attente). */
  ahead: number | null;
  /** Attente estimée en minutes. */
  waitMinutes: number | null;
  /** Poste appelé, déjà traduit : « Cabinet 3 ». */
  counter: string | null;
  /** Lien de suivi du ticket (`absoluteUrl('/t/<jeton>')`). */
  link: string;
  /** Heure de retour du praticien en retard, « 10:30 ». */
  lateUntil: string | null;
};

type Template = {
  /** Nom du modèle chez Meta (identique en FR et EN). */
  name: string;
  /** Corps exact soumis à Meta ; {{n}} = variables, dans l'ordre de `params`. */
  body: Record<NotifLocale, string>;
  params: (d: NotificationData) => string[];
};

const STOP: Record<NotifLocale, string> = {
  fr: "Répondez STOP pour ne plus recevoir ces messages.",
  en: "Reply STOP to stop these messages.",
};
const num = (n: number | null) => String(n ?? 0);

export const WHATSAPP_TEMPLATES: Record<NotifEvent, Template> = {
  ticket_confirmed: {
    name: "ticket_confirme",
    body: {
      fr: `Votre ticket {{1}} est bien enregistré chez {{2}}.\nPersonnes devant vous : {{3}}. Attente estimée : environ {{4}} min.\nSuivez votre ticket : {{5}}\nNous vous préviendrons quand votre tour approche. ${STOP.fr}`,
      en: `Your ticket {{1}} is confirmed at {{2}}.\nPeople ahead of you: {{3}}. Estimated wait: about {{4}} min.\nTrack your ticket: {{5}}\nWe will let you know when your turn is near. ${STOP.en}`,
    },
    params: (d) => [d.code, d.place, num(d.ahead), num(d.waitMinutes), d.link],
  },
  almost_your_turn: {
    name: "bientot_votre_tour",
    body: {
      fr: `Votre tour approche : ticket {{1}} chez {{2}}.\nPersonnes devant vous : {{3}}. Attente estimée : environ {{4}} min.\nMerci de vous rapprocher de la salle d'attente. ${STOP.fr}`,
      en: `Your turn is coming up: ticket {{1}} at {{2}}.\nPeople ahead of you: {{3}}. Estimated wait: about {{4}} min.\nPlease make your way to the waiting area. ${STOP.en}`,
    },
    params: (d) => [d.code, d.place, num(d.ahead), num(d.waitMinutes)],
  },
  your_turn: {
    name: "cest_votre_tour",
    body: {
      fr: `C'est votre tour ! Ticket {{1}} chez {{2}}.\nPrésentez-vous : {{3}}.\n${STOP.fr}`,
      en: `It's your turn! Ticket {{1}} at {{2}}.\nPlease go to: {{3}}.\n${STOP.en}`,
    },
    params: (d) => [d.code, d.place, d.counter ?? ""],
  },
  ticket_moved_back: {
    name: "ticket_recule",
    body: {
      fr: `Votre ticket {{1}} chez {{2}} a été déplacé dans la file.\nPersonnes devant vous : {{3}}. Attente estimée : environ {{4}} min.\n${STOP.fr}`,
      en: `Your ticket {{1}} at {{2}} has been moved in the queue.\nPeople ahead of you: {{3}}. Estimated wait: about {{4}} min.\n${STOP.en}`,
    },
    params: (d) => [d.code, d.place, num(d.ahead), num(d.waitMinutes)],
  },
  practitioner_rerouted: {
    name: "praticien_reoriente",
    body: {
      fr: `Votre ticket {{1}} chez {{2}} : votre praticien est absent. Un autre praticien de la même spécialité vous recevra, sans perdre votre place.\nAttente estimée : environ {{3}} min.\n${STOP.fr}`,
      en: `Your ticket {{1}} at {{2}}: your practitioner is absent. Another practitioner of the same specialty will see you, and you keep your place.\nEstimated wait: about {{3}} min.\n${STOP.en}`,
    },
    params: (d) => [d.code, d.place, num(d.waitMinutes)],
  },
  practitioner_late: {
    name: "praticien_en_retard",
    body: {
      fr: `Votre ticket {{1}} chez {{2}} : votre praticien a du retard, retour prévu vers {{3}}. Votre place est conservée.\nAttente estimée : environ {{4}} min.\n${STOP.fr}`,
      en: `Your ticket {{1}} at {{2}}: your practitioner is running late and is expected back around {{3}}. You keep your place.\nEstimated wait: about {{4}} min.\n${STOP.en}`,
    },
    params: (d) => [d.code, d.place, d.lateUntil ?? "", num(d.waitMinutes)],
  },
};

/** Remplace {{1}}, {{2}}… par les valeurs (même rendu que Meta). */
export function fillTemplate(body: string, params: readonly string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, i: string) => params[Number(i) - 1] ?? "");
}

/** Variables propres d'un modèle : Meta refuse les retours à la ligne, tabulations et 4 espaces consécutifs. */
export function templateParams(event: NotifEvent, data: NotificationData): string[] {
  return WHATSAPP_TEMPLATES[event].params(data).map((p) => p.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim() || "-");
}

/** Texte WhatsApp (message libre dans la fenêtre de 24 h) : identique au modèle. */
export function whatsappText(event: NotifEvent, locale: NotifLocale, data: NotificationData): string {
  return fillTemplate(WHATSAPP_TEMPLATES[event].body[locale], templateParams(event, data));
}

/** Sans accents : un SMS en alphabet GSM-7 tient en 160 caractères (70 seulement en Unicode). */
export function toGsm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/≈/g, "~");
}

const SMS: Record<NotifLocale, Record<NotifEvent, (d: NotificationData) => string>> = {
  fr: {
    ticket_confirmed: (d) => `NextIn : ticket ${d.code} enregistre chez ${d.place}. ${num(d.ahead)} devant vous, ~${num(d.waitMinutes)} min. ${d.link}`,
    almost_your_turn: (d) => `NextIn : votre tour approche, ticket ${d.code}. ${num(d.ahead)} devant vous, ~${num(d.waitMinutes)} min.`,
    your_turn: (d) => `NextIn : c'est votre tour ! Ticket ${d.code}, presentez-vous : ${d.counter ?? ""}.`,
    ticket_moved_back: (d) => `NextIn : ticket ${d.code} deplace dans la file. ${num(d.ahead)} devant vous, ~${num(d.waitMinutes)} min.`,
    practitioner_rerouted: (d) => `NextIn : ticket ${d.code}, votre praticien est absent. Un collegue vous recevra, place conservee. ~${num(d.waitMinutes)} min.`,
    practitioner_late: (d) => `NextIn : ticket ${d.code}, votre praticien a du retard (retour vers ${d.lateUntil ?? ""}). Place conservee.`,
  },
  en: {
    ticket_confirmed: (d) => `NextIn: ticket ${d.code} confirmed at ${d.place}. ${num(d.ahead)} ahead of you, ~${num(d.waitMinutes)} min. ${d.link}`,
    almost_your_turn: (d) => `NextIn: your turn is coming up, ticket ${d.code}. ${num(d.ahead)} ahead of you, ~${num(d.waitMinutes)} min.`,
    your_turn: (d) => `NextIn: it's your turn! Ticket ${d.code}, please go to: ${d.counter ?? ""}.`,
    ticket_moved_back: (d) => `NextIn: ticket ${d.code} moved in the queue. ${num(d.ahead)} ahead of you, ~${num(d.waitMinutes)} min.`,
    practitioner_rerouted: (d) => `NextIn: ticket ${d.code}, your practitioner is absent. A colleague will see you, place kept. ~${num(d.waitMinutes)} min.`,
    practitioner_late: (d) => `NextIn: ticket ${d.code}, your practitioner is running late (back around ${d.lateUntil ?? ""}). Place kept.`,
  },
};

export function smsText(event: NotifEvent, locale: NotifLocale, data: NotificationData): string {
  return toGsm(SMS[locale][event](data));
}

const PUSH: Record<NotifLocale, Record<NotifEvent, (d: NotificationData) => { title: string; body: string }>> = {
  fr: {
    ticket_confirmed: (d) => ({ title: `Ticket ${d.code} confirmé`, body: `${num(d.ahead)} devant vous · environ ${num(d.waitMinutes)} min` }),
    almost_your_turn: (d) => ({ title: "Votre tour approche", body: `Ticket ${d.code} · ${num(d.ahead)} devant vous` }),
    your_turn: (d) => ({ title: "C'est votre tour !", body: `Ticket ${d.code} · ${d.counter ?? ""}` }),
    ticket_moved_back: (d) => ({ title: "Ticket déplacé", body: `${d.code} · ${num(d.ahead)} devant vous · environ ${num(d.waitMinutes)} min` }),
    practitioner_rerouted: (d) => ({ title: "Changement de praticien", body: `Ticket ${d.code} : un collègue vous recevra, votre place est conservée.` }),
    practitioner_late: (d) => ({ title: "Votre praticien a du retard", body: `Retour prévu vers ${d.lateUntil ?? ""} · ticket ${d.code}` }),
  },
  en: {
    ticket_confirmed: (d) => ({ title: `Ticket ${d.code} confirmed`, body: `${num(d.ahead)} ahead of you · about ${num(d.waitMinutes)} min` }),
    almost_your_turn: (d) => ({ title: "Your turn is coming up", body: `Ticket ${d.code} · ${num(d.ahead)} ahead of you` }),
    your_turn: (d) => ({ title: "It's your turn!", body: `Ticket ${d.code} · ${d.counter ?? ""}` }),
    ticket_moved_back: (d) => ({ title: "Ticket moved", body: `${d.code} · ${num(d.ahead)} ahead of you · about ${num(d.waitMinutes)} min` }),
    practitioner_rerouted: (d) => ({ title: "Change of practitioner", body: `Ticket ${d.code}: a colleague will see you, you keep your place.` }),
    practitioner_late: (d) => ({ title: "Your practitioner is running late", body: `Expected back around ${d.lateUntil ?? ""} · ticket ${d.code}` }),
  },
};

export function pushMessage(event: NotifEvent, locale: NotifLocale, data: NotificationData) {
  return { ...PUSH[locale][event](data), url: data.link, tag: `nextin-${data.code}` };
}

/** Réponses libres aux messages entrants (toujours dans la fenêtre de 24 h ouverte par le client). */
export const REPLIES: Record<NotifLocale, { stopped: string; restarted: string; notFound: string; help: string }> = {
  fr: {
    stopped: "C'est noté : vous ne recevrez plus de messages NextIn sur ce numéro. Envoyez START pour les réactiver.",
    restarted: "C'est noté : les messages NextIn sont réactivés sur ce numéro.",
    notFound:
      "Nous n'avons pas trouvé de ticket en cours avec ce message. Ouvrez votre ticket NextIn et touchez à nouveau « Recevoir mes alertes sur WhatsApp ».",
    help: "Ce numéro envoie uniquement les alertes de vos tickets NextIn. Pour les recevoir, touchez « Recevoir mes alertes sur WhatsApp » sur votre ticket. Envoyez STOP pour ne plus recevoir de messages.",
  },
  en: {
    stopped: "Done: you will no longer receive NextIn messages on this number. Send START to turn them back on.",
    restarted: "Done: NextIn messages are turned back on for this number.",
    notFound: "We couldn't find an active ticket for this message. Open your NextIn ticket and tap “Get my alerts on WhatsApp” again.",
    help: "This number only sends alerts for your NextIn tickets. To receive them, tap “Get my alerts on WhatsApp” on your ticket. Send STOP to stop messages.",
  },
};
