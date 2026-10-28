import { absoluteUrl } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import {
  WHATSAPP_TEMPLATES,
  guardSatisfied,
  isStillRelevant,
  pushMessage,
  retryDelaySeconds,
  smsText,
  templateParams,
  whatsappMode,
  whatsappText,
  type NotifChannel,
  type NotifEvent,
  type NotificationData,
  type NotifLocale,
} from "@nextin/shared/notifications";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import type { TicketView } from "@/lib/client/types";
import type { Providers } from "./providers";
import type { PushSubscriptionJson, SendResult } from "./providers/types";

/** Job réservé par `claim_notification_jobs`. */
export type ClaimedJob = {
  id: string;
  event: NotifEvent;
  channel: NotifChannel;
  attempt: number;
  /** Données de l'événement : heure de retour du praticien (M5), code de vérification d'une demande (M9). */
  payload: { until?: string | null; code?: string | null };
  guard: boolean;
  /** Quota WhatsApp mensuel de la formule atteint (M10a) : les autres canaux prennent le relais. */
  quota_exceeded?: boolean;
  fallback_status: string | null;
  contact: {
    id: string;
    phone_e164: string | null;
    locale: NotifLocale;
    push_subscription: PushSubscriptionJson | null;
    window_expires_at: string | null;
    opted_out: boolean;
  } | null;
  token: string | null;
  /** Ticket concerné (null pour un message de rendez-vous avant l'arrivée). */
  ticket: TicketView | null;
  /** Rendez-vous (M5b) : praticien, établissement, heure ; jamais le libellé du patient. */
  appointment?: AppointmentNotice | null;
  /** Demande de rendez-vous (M9) : code de vérification ou refus. */
  request?: RequestNotice | null;
};

export type RequestNotice = {
  id: string;
  status: "unverified" | "pending" | "accepted" | "modified" | "declined" | "expired" | "cancelled";
  token: string;
  service: string;
  branch: string;
  organization: string;
  timezone: string;
  preferred_starts_at: string | null;
  preferred_day: string | null;
  decline_reason: string | null;
};

export type AppointmentNotice = {
  id: string;
  status: "confirmed" | "checked_in" | "completed" | "rescheduled" | "cancelled" | "no_show";
  starts_at: string;
  timezone: string;
  practitioner: string;
  service: string;
  branch: string;
  organization: string;
};

export type Outcome = { status: "sent" | "failed" | "skipped"; retryIn?: number | null; messageId?: string; error?: string; template?: string; text?: string };

const TIME_ZONE = "Africa/Douala";

/** Données du message au moment de l'envoi (position et attente à jour, poste traduit). */
export function notificationData(job: ClaimedJob): NotificationData {
  const t = job.ticket;
  const locale = job.contact?.locale ?? "fr";
  const a = job.appointment;
  const r = job.request;
  if (!t && !a && r) {
    return {
      code: "",
      place: `${r.organization} – ${r.branch}`,
      ahead: null,
      waitMinutes: null,
      counter: null,
      link: absoluteUrl(`/r/${r.token}`),
      lateUntil: null,
      otp: job.payload.code ?? null,
      reason: r.decline_reason,
    };
  }
  if (!t && a) {
    const at = new Date(a.starts_at);
    return {
      code: "",
      place: `${a.organization} – ${a.branch}`,
      ahead: null,
      waitMinutes: null,
      counter: null,
      link: absoluteUrl("/"),
      lateUntil: null,
      appointment: {
        date: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: a.timezone }).format(at),
        time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: a.timezone }).format(at),
        practitioner: a.practitioner,
      },
    };
  }
  if (!t) throw new Error("job without ticket nor appointment");
  const kinds = messages[locale].counterKinds;
  return {
    code: t.display_code,
    place: `${t.organization.name} – ${t.branch.name}`,
    ahead: t.position != null ? Math.max(0, t.position - 1) : null,
    waitMinutes: t.wait_seconds != null ? waitMinutes(t.wait_seconds) : null,
    counter: t.counter ? (t.counter.label ?? `${kinds[t.counter.kind]} ${t.counter.number}`) : null,
    link: job.token ? absoluteUrl(`/t/${job.token}`) : absoluteUrl("/t"),
    lateUntil: job.payload.until
      ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(job.payload.until))
      : null,
    penaltyPlaces: t.remote?.penalty_places ?? null,
  };
}

function fromResult(r: SendResult, attempt: number, extra: Pick<Outcome, "template" | "text">): Outcome {
  if (r.ok) return { status: "sent", messageId: r.messageId, ...extra };
  return { status: "failed", error: r.error, retryIn: r.retryable ? retryDelaySeconds(attempt) : null, ...extra };
}

/** Envoie un job et renvoie son résultat (aucune écriture en base ici). */
export async function sendJob(
  job: ClaimedJob,
  providers: Providers,
  onPushGone?: (contactId: string) => PromiseLike<unknown>,
): Promise<Outcome> {
  const contact = job.contact;
  if (!contact) return { status: "skipped", error: "no_contact" };
  const subjectStatus = job.ticket?.status ?? job.appointment?.status ?? job.request?.status;
  if (!subjectStatus || !isStillRelevant(job.event, subjectStatus as Parameters<typeof isStillRelevant>[1])) {
    return { status: "skipped", error: "not_relevant" };
  }
  if (job.guard && guardSatisfied(job.fallback_status)) return { status: "skipped", error: "original_delivered" };
  const data = notificationData(job);
  const locale = contact.locale;
  if (job.event === "request_code" && !data.otp) return { status: "skipped", error: "code_expired" };
  // Le texte enregistré ne contient jamais le code de vérification.
  const saved = (text: string) => (data.otp ? text.split(data.otp).join("••••••") : text);

  switch (job.channel) {
    case "whatsapp": {
      if (contact.opted_out || !contact.phone_e164) return { status: "skipped", error: "opted_out" };
      if (job.quota_exceeded) return { status: "skipped", error: "quota_exceeded" };
      if (whatsappMode(contact.window_expires_at) === "session") {
        const text = whatsappText(job.event, locale, data);
        return fromResult(await providers.whatsapp.sendText(contact.phone_e164, text), job.attempt, { text: saved(text) });
      }
      const spec = WHATSAPP_TEMPLATES[job.event];
      const params = templateParams(job.event, data);
      // Modèle d'authentification : le code est aussi transmis au bouton « Copier le code ».
      const r =
        spec.category === "authentication" && data.otp
          ? await providers.whatsapp.sendTemplate(contact.phone_e164, spec.name, locale, params, data.otp)
          : await providers.whatsapp.sendTemplate(contact.phone_e164, spec.name, locale, params);
      return fromResult(r, job.attempt, { template: spec.name, text: saved(whatsappText(job.event, locale, data)) });
    }
    case "sms": {
      if (contact.opted_out || !contact.phone_e164) return { status: "skipped", error: "opted_out" };
      const text = smsText(job.event, locale, data);
      return fromResult(await providers.sms.send(contact.phone_e164, text), job.attempt, { text: saved(text) });
    }
    case "push": {
      if (contact.opted_out || !contact.push_subscription) return { status: "skipped", error: "opted_out" };
      const message = pushMessage(job.event, locale, data);
      const r = await providers.push.send(contact.push_subscription, message);
      if (!r.ok && r.gone) await onPushGone?.(contact.id);
      return fromResult(r, job.attempt, { text: saved(`${message.title} — ${message.body}`) });
    }
  }
}

