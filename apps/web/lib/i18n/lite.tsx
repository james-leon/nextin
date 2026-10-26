"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { formatMessage, type MessageValues } from "./format";

/**
 * Traductions des pages client sans next-intl côté navigateur (budget < 200 Ko).
 * Le serveur transmet seulement les espaces de noms utiles ; même syntaxe de clés que next-intl.
 */
type Messages = Record<string, unknown>;
const Ctx = createContext<{ locale: string; messages: Messages }>({ locale: "fr", messages: {} });

export function LiteIntlProvider({ locale, messages, children }: { locale: string; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiteLocale(): string {
  return useContext(Ctx).locale;
}

function lookup(messages: Messages, path: string): string | undefined {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type LiteT = ((key: string, values?: MessageValues) => string) & { has: (key: string) => boolean };

export function useLiteT(namespace: string): LiteT {
  const { locale, messages } = useContext(Ctx);
  const t = useCallback(
    (key: string, values?: MessageValues) => {
      const message = lookup(messages, `${namespace}.${key}`);
      return message === undefined ? `${namespace}.${key}` : formatMessage(message, values, locale);
    },
    [messages, namespace, locale],
  );
  return useMemo(() => Object.assign(t, { has: (key: string) => lookup(messages, `${namespace}.${key}`) !== undefined }), [t, messages, namespace]);
}
