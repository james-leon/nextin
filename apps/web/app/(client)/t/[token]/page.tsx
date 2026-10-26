import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Ticket } from "lucide-react";
import { TicketLive } from "@/components/client/ticket-live";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";
import type { TicketView } from "@/lib/client/types";

type Params = { params: Promise<{ token: string }> };

const TOKEN = /^[A-Za-z0-9]{22}$/;

async function load(token: string): Promise<TicketView | null> {
  if (!TOKEN.test(token)) return null;
  const { data } = await callRpc<TicketView | null>("get_ticket", { p_token: token });
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const view = await load((await params).token);
  const t = await getTranslations("client.ticket");
  // Lien personnel : jamais indexé, jamais transmis comme référent.
  return { title: view ? `${view.display_code} · ${t("title")}` : t("notFoundTitle"), robots: { index: false }, referrer: "no-referrer" };
}

/** Écran 03 : suivi du ticket par son lien personnel /t/<jeton>. */
export default async function TicketPage({ params }: Params) {
  const { token } = await params;
  const view = await load(token);
  if (view) return <TicketLive token={token} initial={view} />;

  const t = await getTranslations("client.ticket");
  return (
    <main className="min-h-dvh pb-40">
      <NavigationBar variant="inline" title={t("title")} back={{ href: "/", label: t("home") }} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
        <CalloutCard icon={<Ticket />} tone="red" role="alert">
          <strong className="font-semibold">{t("notFoundTitle")}.</strong> {t("notFoundBody")}
        </CalloutCard>
        <Button asChild block variant="tinted">
          <Link href="/">{t("newTicket")}</Link>
        </Button>
      </div>
    </main>
  );
}
