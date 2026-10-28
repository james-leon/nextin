import { getLocale, getMessages } from "next-intl/server";
import { LiteIntlProvider } from "@/lib/i18n/lite";

/**
 * Pages client (scan, choix du service, ticket) : légères, rendues côté serveur.
 * Seuls les textes nécessaires sont transmis au navigateur, sans bibliothèque de traduction côté client.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  return (
    <LiteIntlProvider locale={locale} messages={{ common: m.common, errors: m.errors, client: m.client, counterKinds: m.counterKinds, weekdays: m.weekdays }}>
      {children}
    </LiteIntlProvider>
  );
}
