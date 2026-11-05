import "server-only";
import { consoleEmail, smtpConfigFromEnv, smtpEmail } from "./email";
import { consoleSms } from "./sms";
import { fakePush, webPush } from "./push";
import { cloudWhatsApp, fakeWhatsApp } from "./whatsapp";
import type { EmailProvider, PushProvider, SmsProvider, WhatsAppProvider } from "./types";

export type Providers = { whatsapp: WhatsAppProvider; sms: SmsProvider; push: PushProvider; email: EmailProvider };

const log = (line: string) => {
  if (process.env.NODE_ENV !== "production" || process.env.NOTIFY_LOG === "1") console.info(line);
};

/**
 * Fournisseurs selon l'environnement : WhatsApp Cloud API dès que WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID
 * sont présents (faux fournisseur sinon) ; web push dès que les clés VAPID sont présentes ; e-mail par SMTP si
 * EMAIL_PROVIDER=smtp (Brevo, Resend : SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM), `console` sinon ; SMS `console`.
 */
export function getProviders(env: Record<string, string | undefined> = process.env): Providers {
  const whatsapp =
    env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID
      ? cloudWhatsApp({ token: env.WHATSAPP_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID })
      : fakeWhatsApp(log);
  const push =
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? webPush({ publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT })
      : fakePush(log);
  if (env.SMS_PROVIDER && env.SMS_PROVIDER !== "console") {
    console.warn(`SMS_PROVIDER=${env.SMS_PROVIDER} n'est pas encore pris en charge : SMS affichés dans la console.`);
  }
  return { whatsapp, sms: consoleSms(log), push, email: emailProvider(env) };
}

let warned = false;
const warnOnce = (message: string) => {
  if (!warned) console.warn(message);
  warned = true;
};

/** Fournisseur d'e-mails : SMTP si demandé et complet ; sinon console (avec un avertissement, jamais de valeur affichée). */
function emailProvider(env: Record<string, string | undefined>) {
  const choice = env.EMAIL_PROVIDER?.trim() || "console";
  if (choice === "smtp") {
    const { config, missing } = smtpConfigFromEnv(env);
    if (config) return smtpEmail(config, log);
    warnOnce(`EMAIL_PROVIDER=smtp : variable(s) manquante(s) ${missing.join(", ")} (voir .env.example). E-mails affichés dans la console.`);
  } else if (choice !== "console") {
    warnOnce(`EMAIL_PROVIDER=${choice} n'est pas pris en charge (smtp ou console). E-mails affichés dans la console.`);
  }
  return consoleEmail(log);
}
