import { randomUUID } from "node:crypto";
import { maskPhone, type SmsProvider } from "./types";

/**
 * SMS de secours. Fournisseur réel à choisir (docs/modules/M7.md) ; en attendant, `console` :
 * rien n'est envoyé, le texte est gardé dans `notification_jobs.payload` et affiché dans le terminal.
 */
export function consoleSms(log: (line: string) => void = () => undefined): SmsProvider {
  return {
    name: "console",
    async send(to, text) {
      log(`[sms:console] ${maskPhone(to)} ${text}`);
      return { ok: true, messageId: `console.${randomUUID()}` };
    },
  };
}
