import "server-only";
import { consoleSms } from "./sms";
import { fakePush, webPush } from "./push";
import { cloudWhatsApp, fakeWhatsApp } from "./whatsapp";
import type { PushProvider, SmsProvider, WhatsAppProvider } from "./types";

export type Providers = { whatsapp: WhatsAppProvider; sms: SmsProvider; push: PushProvider };

const log = (line: string) => {
  if (process.env.NODE_ENV !== "production" || process.env.NOTIFY_LOG === "1") console.info(line);
};

/**
 * Fournisseurs selon l'environnement : WhatsApp Cloud API dès que WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID
 * sont présents (faux fournisseur sinon) ; web push dès que les clés VAPID sont présentes ; SMS `console`.
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
  return { whatsapp, sms: consoleSms(log), push };
}
