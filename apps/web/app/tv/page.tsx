import type { Metadata, Viewport } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { TvApp } from "@/components/tv/tv-app";
import { LiteIntlProvider } from "@/lib/i18n/lite";

export const metadata: Metadata = { title: { absolute: "NextIn TV" }, robots: { index: false } };
export const viewport: Viewport = { themeColor: "#0b1f3b" };

/** Écran de salle d'attente (maquette 05) : plein écran, sans compte, appairé par code. */
export default async function TvPage() {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  return (
    <div data-theme="light" className="bg-tv">
      <LiteIntlProvider locale={locale} messages={{ tv: m.tv, counterKinds: m.counterKinds }}>
        <TvApp />
      </LiteIntlProvider>
    </div>
  );
}
