/**
 * E-mails des demandes de rendez-vous en ligne et des rendez-vous qui en découlent : code de vérification, réponse de
 * l'accueil, rappels. Texte brut + HTML (mise en page sobre façon Apple : carte blanche, grand titre, une seule action).
 * Jamais de nom de patient : établissement, service, praticien, date et heure seulement.
 * Les couleurs sont écrites en clair : un client de messagerie ne lit pas les jetons CSS de l'application.
 */
import type { NotifLocale } from "./opt-in";
import { pushMessage, type NotifEvent, type NotificationData } from "./messages";

export type EmailContent = { subject: string; text: string; html: string };

type Block = {
  subject: string;
  /** Aperçu affiché par la messagerie sous l'objet. */
  preheader: string;
  title: string;
  intro: string;
  /** Code de vérification affiché en grand. */
  code?: string | null;
  /** Lignes « libellé : valeur ». */
  rows?: [string, string][];
  notes?: string[];
  action?: { label: string; href: string };
};

const BRAND = "NextIn";

const FOOTER: Record<NotifLocale, string> = {
  fr: "Vous recevez ce message à la suite de votre demande de rendez-vous en ligne sur NextIn. Ne répondez pas à cet e-mail : pour toute question, contactez directement l'établissement. NextIn par Wintek.",
  en: "You are receiving this message because you requested an appointment online with NextIn. Please do not reply to this email: for any question, contact the facility directly. NextIn by Wintek.",
};

const L = {
  fr: {
    place: "Établissement",
    date: "Date",
    time: "Heure",
    practitioner: "Praticien",
    reason: "Motif",
    openRequest: "Ouvrir ma demande",
    viewRequest: "Voir ma demande",
    newRequest: "Faire une nouvelle demande",
    arrival: "À votre arrivée, présentez-vous à l'accueil ou scannez le QR code de la salle d'attente.",
    contact: "Si ce créneau ne vous convient pas, contactez l'établissement.",
  },
  en: {
    place: "Facility",
    date: "Date",
    time: "Time",
    practitioner: "Practitioner",
    reason: "Reason",
    openRequest: "Open my request",
    viewRequest: "View my request",
    newRequest: "Send a new request",
    arrival: "When you arrive, check in at reception or scan the QR code in the waiting room.",
    contact: "If this slot does not suit you, please contact the facility.",
  },
} as const;

function appointmentRows(locale: NotifLocale, d: NotificationData): [string, string][] {
  const l = L[locale];
  const a = d.appointment;
  const rows: [string, string][] = [[l.place, d.place]];
  if (a) rows.push([l.date, a.date], [l.time, a.time], [l.practitioner, a.practitioner]);
  return rows;
}

function block(event: NotifEvent, locale: NotifLocale, d: NotificationData): Block {
  const l = L[locale];
  const fr = locale === "fr";
  const a = d.appointment;
  switch (event) {
    case "request_code":
      return {
        subject: fr ? "Votre code de vérification NextIn" : "Your NextIn verification code",
        preheader: fr ? "Valable 10 minutes. Ne le communiquez à personne." : "Valid for 10 minutes. Do not share it.",
        title: fr ? "Votre code de vérification" : "Your verification code",
        intro: fr
          ? `Saisissez ce code sur la page de votre demande de rendez-vous chez ${d.place}.`
          : `Enter this code on the page of your appointment request at ${d.place}.`,
        code: d.otp,
        notes: [
          fr
            ? "Il expire dans 10 minutes. Pour votre sécurité, ne le communiquez à personne."
            : "It expires in 10 minutes. For your security, do not share it with anyone.",
          fr
            ? "Vous n'avez rien demandé ? Ignorez cet e-mail : aucune demande ne sera transmise sans ce code."
            : "Didn't request anything? Ignore this email: no request is sent without this code.",
        ],
        action: { label: l.openRequest, href: d.link },
      };
    case "request_accepted":
    case "appointment_confirmed":
      return {
        subject: fr ? `Rendez-vous confirmé — ${d.place}` : `Appointment confirmed — ${d.place}`,
        preheader: a ? `${a.date} · ${a.time} · ${a.practitioner}` : d.place,
        title: fr ? "Votre rendez-vous est confirmé" : "Your appointment is confirmed",
        intro: fr ? "L'accueil a confirmé votre rendez-vous." : "Reception has confirmed your appointment.",
        rows: appointmentRows(locale, d),
        notes: [l.arrival],
        action: { label: l.viewRequest, href: d.link },
      };
    case "request_modified":
      return {
        subject: fr ? `Un autre créneau vous est proposé — ${d.place}` : `Another slot is offered — ${d.place}`,
        preheader: a ? `${a.date} · ${a.time} · ${a.practitioner}` : d.place,
        title: fr ? "Un autre créneau vous est proposé" : "Another slot is offered",
        intro: fr
          ? "Votre demande n'a pas pu être gardée telle quelle. L'accueil vous propose ce rendez-vous :"
          : "Your request could not be kept as is. Reception offers you this appointment:",
        rows: appointmentRows(locale, d),
        notes: [l.contact, l.arrival],
        action: { label: l.viewRequest, href: d.link },
      };
    case "request_declined":
      return {
        subject: fr ? `Demande de rendez-vous non acceptée — ${d.place}` : `Appointment request not accepted — ${d.place}`,
        preheader: d.reason ?? d.place,
        title: fr ? "Votre demande n'a pas pu être acceptée" : "Your request could not be accepted",
        intro: fr ? `L'accueil de ${d.place} n'a pas pu accepter votre demande.` : `Reception at ${d.place} could not accept your request.`,
        rows: d.reason ? [[l.reason, d.reason]] : [],
        notes: [fr ? "Vous pouvez faire une nouvelle demande, ou appeler l'établissement." : "You can send a new request, or call the facility."],
        action: { label: l.viewRequest, href: d.link },
      };
    case "appointment_reminder_day_before":
      return {
        subject: fr ? `Rappel : rendez-vous demain à ${a?.time ?? ""}` : `Reminder: appointment tomorrow at ${a?.time ?? ""}`,
        preheader: `${d.place} · ${a?.practitioner ?? ""}`,
        title: fr ? "Votre rendez-vous, c'est demain" : "Your appointment is tomorrow",
        intro: fr ? "Petit rappel de votre rendez-vous :" : "A quick reminder of your appointment:",
        rows: appointmentRows(locale, d),
        notes: [l.arrival],
        action: { label: l.viewRequest, href: d.link },
      };
    case "appointment_reminder_2h":
      return {
        subject: fr ? `Rappel : rendez-vous aujourd'hui à ${a?.time ?? ""}` : `Reminder: appointment today at ${a?.time ?? ""}`,
        preheader: `${d.place} · ${a?.practitioner ?? ""}`,
        title: fr ? `Votre rendez-vous, c'est à ${a?.time ?? ""}` : `Your appointment is at ${a?.time ?? ""}`,
        intro: fr ? "Pensez à partir à temps." : "Remember to leave in good time.",
        rows: appointmentRows(locale, d),
        notes: [l.arrival],
        action: { label: l.viewRequest, href: d.link },
      };
    case "appointment_rescheduled":
      return {
        subject: fr ? `Rendez-vous déplacé — ${d.place}` : `Appointment moved — ${d.place}`,
        preheader: a ? `${a.date} · ${a.time}` : d.place,
        title: fr ? "Votre rendez-vous a été déplacé" : "Your appointment has been moved",
        intro: fr ? "Voici votre nouveau rendez-vous :" : "Here is your new appointment:",
        rows: appointmentRows(locale, d),
        notes: [l.contact],
        action: { label: l.viewRequest, href: d.link },
      };
    case "appointment_cancelled":
      return {
        subject: fr ? `Rendez-vous annulé — ${d.place}` : `Appointment cancelled — ${d.place}`,
        preheader: a ? `${a.date} · ${a.time}` : d.place,
        title: fr ? "Votre rendez-vous a été annulé" : "Your appointment has been cancelled",
        intro: fr ? "Le rendez-vous suivant a été annulé :" : "The following appointment has been cancelled:",
        rows: appointmentRows(locale, d),
        notes: [fr ? "Vous pouvez faire une nouvelle demande, ou appeler l'établissement." : "You can send a new request, or call the facility."],
        action: { label: l.newRequest, href: d.link },
      };
    default: {
      // Autres messages (file d'attente) : même contenu que la notification.
      const push = pushMessage(event, locale, d);
      return { subject: `${push.title} — ${BRAND}`, preheader: push.body, title: push.title, intro: push.body, action: { label: l.viewRequest, href: d.link } };
    }
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Texte brut (lu par les messageries sans HTML et par les lecteurs d'écran). */
function toText(b: Block, locale: NotifLocale): string {
  const sep = locale === "fr" ? "\u00a0: " : ": ";
  const lines = [b.title, "", b.intro];
  if (b.code) lines.push("", b.code);
  if (b.rows?.length) lines.push("", ...b.rows.map(([k, v]) => `${k}${sep}${v}`));
  if (b.notes?.length) lines.push("", ...b.notes);
  if (b.action) lines.push("", `${b.action.label}${sep}${b.action.href}`);
  lines.push("", "—", FOOTER[locale]);
  return lines.join("\n");
}

function toHtml(b: Block, locale: NotifLocale): string {
  const e = escapeHtml;
  const rows = b.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">${b.rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #E8EDF4;font-size:15px;color:#5B6676;width:40%">${e(k)}</td><td style="padding:10px 0;border-bottom:1px solid #E8EDF4;font-size:15px;font-weight:600;color:#0B1B2B">${e(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const code = b.code
    ? `<div style="margin:0 0 20px;padding:18px 12px;border-radius:16px;background:#F1F4F9;text-align:center;font-size:36px;line-height:1;font-weight:800;letter-spacing:10px;color:#0D2C54;font-variant-numeric:tabular-nums">${e(b.code)}</div>`
    : "";
  const notes = (b.notes ?? []).map((n) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#5B6676">${e(n)}</p>`).join("");
  const action = b.action
    ? `<p style="margin:8px 0 0"><a href="${e(b.action.href)}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#0D2C54;color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none">${e(b.action.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${e(b.subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1B2B">
<div style="display:none;max-height:0;overflow:hidden">${e(b.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 8px 16px;font-size:20px;font-weight:800;color:#0D2C54">${BRAND}</td></tr>
<tr><td style="padding:32px 28px;border:1px solid #E8EDF4;border-radius:24px;background:#FFFFFF">
<h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:700;color:#0B1B2B">${e(b.title)}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#3C4A5C">${e(b.intro)}</p>
${code}${rows}${notes}${action}
</td></tr>
<tr><td style="padding:16px 8px;font-size:12px;line-height:1.5;color:#5B6676">${e(FOOTER[locale])}</td></tr>
</table></td></tr></table>
</body>
</html>`;
}

/** E-mail d'un événement (objet, texte brut, HTML). */
export function notificationEmail(event: NotifEvent, locale: NotifLocale, data: NotificationData): EmailContent {
  const b = block(event, locale, data);
  return { subject: b.subject, text: toText(b, locale), html: toHtml(b, locale) };
}
