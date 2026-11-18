import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientTabs } from "@/components/client/client-tabs";
import { MyTickets } from "@/components/client/my-tickets";
import { LiteMessages } from "@/lib/i18n/lite-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.myTickets");
  return { title: t("title") };
}

/** Onglet « Tickets » (maquette v2 01) : en cours et historique de cet appareil. */
export default async function MyTicketsPage() {
  const t = await getTranslations("client.myTickets");
  return (
    <main className="flex min-h-dvh flex-col pb-28">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] lg:max-w-[40rem] lg:pt-12">
        <h1 className="text-large-title font-bold">{t("title")}</h1>
        <LiteMessages paths={["client.myTickets"]}>
          <MyTickets />
        </LiteMessages>
      </div>
      <ClientTabs active="tickets" />
    </main>
  );
}
