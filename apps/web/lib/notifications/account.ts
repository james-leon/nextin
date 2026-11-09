import { absoluteUrl } from "@nextin/shared";
import {
  ACCOUNT_TEMPLATES,
  accountEmail,
  accountSmsText,
  accountTemplateKey,
  accountTemplateParams,
  type AccountMessageData,
  type AccountMessageKind,
} from "@nextin/shared/billing";
import { retryDelaySeconds } from "@nextin/shared/notifications";
import type { Providers } from "./providers";
import type { SendResult } from "./providers/types";

/** Message réservé par `claim_account_messages`. */
export type ClaimedAccountMessage = {
  id: string;
  organization_id: string | null;
  kind: AccountMessageKind | "invoice_available";
  channel: "whatsapp" | "sms" | "email";
  to_phone: string | null;
  to_email: string | null;
  locale: "fr" | "en";
  payload: AccountMessageData & { pay_token?: string | null; invoice_id?: string };
  attempt: number;
};

export type AccountOutcome = { status: "sent" | "failed" | "skipped"; error?: string; retryIn?: number | null };

/** Lien du message : page de paiement du rappel, sinon page Abonnement de l'établissement. */
export function accountLink(m: ClaimedAccountMessage): string {
  if (m.payload.pay_token) return absoluteUrl(`/pay/${m.payload.pay_token}`);
  return m.organization_id ? absoluteUrl(`/app/o/${m.organization_id}/billing`) : absoluteUrl("/app");
}

function outcome(r: SendResult, attempt: number): AccountOutcome {
  if (r.ok) return { status: "sent" };
  // Trois essais au plus ; ensuite échec définitif (la base programme alors le SMS de secours si besoin).
  return { status: "failed", error: r.error, retryIn: r.retryable && attempt < 3 ? retryDelaySeconds(attempt) : null };
}

/** Envoie un message du compte (aucune écriture en base ici ; le texte n'est jamais enregistré). */
export async function sendAccountMessage(m: ClaimedAccountMessage, providers: Providers): Promise<AccountOutcome> {
  if (m.kind === "invoice_available") return { status: "skipped", error: "unsupported" };
  if (m.kind === "phone_code" && !m.payload.code) return { status: "skipped", error: "code_cleared" };
  const data: AccountMessageData = { ...m.payload, link: accountLink(m) };
  switch (m.channel) {
    case "whatsapp": {
      if (!m.to_phone) return { status: "skipped", error: "no_phone" };
      const spec = ACCOUNT_TEMPLATES[accountTemplateKey(m.kind, data)];
      const params = accountTemplateParams(m.kind, m.locale, data);
      const r =
        spec.category === "authentication"
          ? await providers.whatsapp.sendTemplate(m.to_phone, spec.name, m.locale, params, data.code)
          : await providers.whatsapp.sendTemplate(m.to_phone, spec.name, m.locale, params);
      return outcome(r, m.attempt);
    }
    case "sms": {
      if (!m.to_phone) return { status: "skipped", error: "no_phone" };
      return outcome(await providers.sms.send(m.to_phone, accountSmsText(m.kind, m.locale, data)), m.attempt);
    }
    case "email": {
      if (!m.to_email) return { status: "skipped", error: "no_email" };
      const mail = accountEmail(m.kind, m.locale, data);
      return outcome(await providers.email.send(m.to_email, mail.subject, mail.text), m.attempt);
    }
  }
}
