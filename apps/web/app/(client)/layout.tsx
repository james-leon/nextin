import { getLocale, getMessages } from "next-intl/server";
import { LiteIntlProvider } from "@/lib/i18n/lite";
import { pickMessages } from "@/lib/i18n/lite-server";

/**
 * Pages client (scan, choix du service, ticket) : légères, rendues côté serveur.
 * Le gabarit ne transmet que les textes communs à toutes les pages ; chaque page ajoute les siens (`LiteMessages`).
 */
/** Clés de `common` lues par les composants client (`useLiteT("common")`) ; en ajouter une ici si besoin. */
const CLIENT_COMMON_KEYS = ["onlineUnavailable", "loading", "back", "cancel", "close"] as const;

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  return (
    // Textes communs : seules les clés utilisées par les composants client partent (budget de 200 Ko).
    <LiteIntlProvider locale={locale} messages={pickMessages(m, [...CLIENT_COMMON_KEYS.map((k) => `common.${k}`), "client.tabs"])}>
      {children}
    </LiteIntlProvider>
  );
}
