import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, UserRound } from "lucide-react";
import { ClientTabBar } from "@/components/client/client-tab-bar";
import { Preferences } from "@/components/settings/preferences";
import { preferencesLabels } from "@/lib/i18n/preferences-labels";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.profile");
  return { title: t("title") };
}

/** Onglet « Profil » : apparence, langue, confidentialité ; accès à l'espace du personnel. */
export default async function ProfilePage() {
  const t = await getTranslations("client.profile");
  return (
    <main className="min-h-dvh pb-28">
      <NavigationBar title={t("title")} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-7 px-4 pt-3">
        <Preferences labels={await preferencesLabels(t("appearanceFooter"))} locale={await getLocale()} />
        <section>
          <h3 className="px-4 pb-1.5 text-footnote uppercase text-label-secondary">{t("privacyHeader")}</h3>
          <CalloutCard icon={<ShieldCheck />} tone="green">
            {t("privacy")}
          </CalloutCard>
        </section>
        <ListSection>
          <ListRow
            href="/login"
            icon={
              <ListIcon color="var(--brand-tile)">
                <UserRound />
              </ListIcon>
            }
            title={t("staff")}
            accessory="chevron"
          />
        </ListSection>
      </div>
      <ClientTabBar active="profile" />
    </main>
  );
}
