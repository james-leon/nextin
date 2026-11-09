import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientTabBar } from "@/components/client/client-tab-bar";
import { MyTicketRedirect } from "@/components/client/my-ticket-redirect";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { LiteMessages } from "@/lib/i18n/lite-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.myTickets");
  return { title: t("title") };
}

/** Onglet « Mon ticket ». */
export default async function MyTicketPage() {
  const t = await getTranslations("client.myTickets");
  return (
    <main className="flex min-h-dvh flex-col pb-28">
      <NavigationBar title={t("title")} contentClassName="max-w-lg" />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-3">
        <LiteMessages paths={["client.myTickets"]}>
          <MyTicketRedirect />
        </LiteMessages>
      </div>
      <ClientTabBar active="ticket" />
    </main>
  );
}
