import type { Metadata, Viewport } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { TvApp } from "@/components/tv/tv-app";
import { LiteIntlProvider } from "@/lib/i18n/lite";
import "./tv.css";

export const metadata: Metadata = { title: { absolute: "NextIn TV" }, robots: { index: false } };
export const viewport: Viewport = { themeColor: "#0d2c54" };

/** Écran de salle d'attente (maquettes v2 09 et 23) : toujours clair, plein écran, sans compte, appairé par code. */
export default async function TvPage() {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  const ticket = m.client.ticket;
  return (
    <div data-theme="light" className="bg-grouped">
      <LiteIntlProvider
        locale={locale}
        messages={{ tv: m.tv, counterKinds: m.counterKinds, client: { ticket: { goTo: ticket.goTo, goToLabel: ticket.goToLabel } } }}
      >
        <TvApp />
      </LiteIntlProvider>
    </div>
  );
}
