import { getLocale, getMessages } from "next-intl/server";
import { LiteIntlProvider } from "@/lib/i18n/lite";
import { pickMessages } from "@/lib/i18n/lite-server";

/**
 * Pages client (scan, choix du service, ticket) : légères, rendues côté serveur.
 * Le gabarit ne transmet que les textes communs à toutes les pages ; chaque page ajoute les siens (`LiteMessages`).
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  return (
    <LiteIntlProvider locale={locale} messages={pickMessages(m, ["common", "client.tabs"])}>
      {children}
    </LiteIntlProvider>
  );
}
