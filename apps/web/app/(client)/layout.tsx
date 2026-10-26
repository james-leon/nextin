import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Pages client (scan, choix du service, ticket) : légères, rendues côté serveur.
 * Seuls les textes nécessaires sont transmis au navigateur.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  return (
    <NextIntlClientProvider
      messages={{ common: m.common, theme: m.theme, errors: m.errors, client: m.client, counterKinds: m.counterKinds }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
