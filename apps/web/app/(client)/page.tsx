import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Keyboard, QrCode } from "lucide-react";
import { ClientTabs } from "@/components/client/client-tabs";
import { HomeRecents } from "@/components/client/home-recents";
import { Button } from "@/components/ui/button";
import { LiteMessages } from "@/lib/i18n/lite-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.home");
  return { title: { absolute: `NextIn · ${t("title")}` } };
}

/**
 * Accueil du client (maquette v2 01) : date et « Bonjour », une seule action principale (scanner le QR code, en bleu
 * nuit), la saisie du code en secours et les établissements récents de cet appareil. Le plus souvent, le client
 * arrive directement par l'appareil photo sur /q/<jeton>.
 */
export default async function HomePage() {
  const [t, locale] = await Promise.all([getTranslations("client.home"), getLocale()]);
  const today = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Douala" }).format(new Date());
  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] lg:max-w-[40rem] lg:pt-12">
        <header>
          <p className="text-footnote font-medium text-label-secondary uppercase">{today}</p>
          <h1 className="mt-1 text-large-title font-bold">{t("title")}</h1>
        </header>
        <section aria-labelledby="home-take" className="squircle flex flex-col gap-3.5 rounded-[var(--radius-md)] bg-grouped-secondary p-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="squircle flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary text-on-accent">
              <QrCode className="size-6 stroke-[1.75]" />
            </span>
            <div className="min-w-0">
              <h2 id="home-take" className="text-headline">
                {t("takeTitle")}
              </h2>
              <p className="text-subheadline text-label-secondary">{t("takeBody")}</p>
            </div>
          </div>
          <Button asChild block>
            <Link href="/scan" prefetch={false}>
              <QrCode aria-hidden className="size-5" />
              {t("scan")}
            </Link>
          </Button>
          <Button asChild block variant="tinted">
            <Link href="/c" prefetch={false}>
              <Keyboard aria-hidden className="size-5" />
              {t("code")}
            </Link>
          </Button>
        </section>
        <LiteMessages paths={["client.home"]}>
          <HomeRecents />
        </LiteMessages>
      </div>
      <ClientTabs active="home" />
    </main>
  );
}
