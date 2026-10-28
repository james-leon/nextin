import { randomUUID } from "node:crypto";
import type { EmailProvider } from "./types";

/** Adresse masquée pour les journaux. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}…@${domain}`;
}

/**
 * E-mails du compte (rappels, reçus). Fournisseur transactionnel à choisir (docs/modules/M10a.md) ; en attendant,
 * `console` : rien n'est envoyé, l'objet est affiché dans le terminal.
 */
export function consoleEmail(log: (line: string) => void = () => undefined): EmailProvider {
  return {
    name: "console",
    async send(to, subject) {
      log(`[email:console] ${maskEmail(to)} « ${subject} »`);
      return { ok: true, messageId: `console.${randomUUID()}` };
    },
  };
}
