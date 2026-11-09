import { getLocale, getMessages } from "next-intl/server";
import { LiteIntlProvider } from "./lite";

type Messages = Record<string, unknown>;

/** Extrait les chemins demandés (`client.nearby`, `errors`…) en gardant leur imbrication. */
export function pickMessages(messages: Messages, paths: readonly string[]): Messages {
  const out: Messages = {};
  for (const path of paths) {
    const parts = path.split(".");
    let source: unknown = messages;
    for (const part of parts) source = (source as Messages | undefined)?.[part];
    if (source === undefined) continue;
    let target = out;
    for (const part of parts.slice(0, -1)) target = (target[part] ??= {}) as Messages;
    target[parts[parts.length - 1]!] = source;
  }
  return out;
}

/**
 * Textes d'une page client : seuls les espaces de noms qu'elle utilise partent vers le navigateur (budget < 200 Ko).
 * S'ajoutent aux textes communs du gabarit (`common`, `client.tabs`).
 */
export async function LiteMessages({ paths, children }: { paths: readonly string[]; children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <LiteIntlProvider locale={locale} messages={pickMessages(messages, paths)}>
      {children}
    </LiteIntlProvider>
  );
}
