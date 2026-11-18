import { getTranslations } from "next-intl/server";
import { ClientTabBar, type ClientTab } from "./client-tab-bar";

/** Barre d'onglets du client avec ses textes (composant serveur : rien à télécharger). */
export async function ClientTabs({ active, mobile = true, className }: { active: ClientTab | null; mobile?: boolean; className?: string }) {
  const t = await getTranslations("client.tabs");
  return (
    <ClientTabBar
      active={active}
      mobile={mobile}
      className={className}
      labels={{ label: t("label"), home: t("home"), nearby: t("nearby"), tickets: t("tickets"), profile: t("profile") }}
    />
  );
}
