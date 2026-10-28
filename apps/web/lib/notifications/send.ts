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
  payload: { until?: string | null };
  guard: boolean;
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
  ticket: TicketView;
};

export type Outcome = { status: "sent" | "failed" | "skipped"; retryIn?: number | null; messageId?: string; error?: string; template?: string; text?: string };

const TIME_ZONE = "Africa/Douala";

/** Données du message au moment de l'envoi (position et attente à jour, poste traduit). */
export function notificationData(job: ClaimedJob): NotificationData {
  const t = job.ticket;
  const locale = job.contact?.locale ?? "fr";
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
  if (!isStillRelevant(job.event, job.ticket.status as Parameters<typeof isStillRelevant>[1])) {
    return { status: "skipped", error: "not_relevant" };
  }
  if (job.guard && guardSatisfied(job.fallback_status)) return { status: "skipped", error: "original_delivered" };
  const data = notificationData(job);
  const locale = contact.locale;

  switch (job.channel) {
    case "whatsapp": {
      if (contact.opted_out || !contact.phone_e164) return { status: "skipped", error: "opted_out" };
      if (whatsappMode(contact.window_expires_at) === "session") {
        const text = whatsappText(job.event, locale, data);
        return fromResult(await providers.whatsapp.sendText(contact.phone_e164, text), job.attempt, { text });
      }
      const template = WHATSAPP_TEMPLATES[job.event].name;
      const r = await providers.whatsapp.sendTemplate(contact.phone_e164, template, locale, templateParams(job.event, data));
      return fromResult(r, job.attempt, { template, text: whatsappText(job.event, locale, data) });
    }
    case "sms": {
      if (contact.opted_out || !contact.phone_e164) return { status: "skipped", error: "opted_out" };
      const text = smsText(job.event, locale, data);
      return fromResult(await providers.sms.send(contact.phone_e164, text), job.attempt, { text });
    }
    case "push": {
      if (contact.opted_out || !contact.push_subscription) return { status: "skipped", error: "opted_out" };
      const message = pushMessage(job.event, locale, data);
      const r = await providers.push.send(contact.push_subscription, message);
      if (!r.ok && r.gone) await onPushGone?.(contact.id);
      return fromResult(r, job.attempt, { text: `${message.title} — ${message.body}` });
    }
  }
}

