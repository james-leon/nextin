import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleHelp, FileText, UserRound } from "lucide-react";
import { ClientTabs } from "@/components/client/client-tabs";
import { Preferences } from "@/components/settings/preferences";
import { preferencesLabels } from "@/lib/i18n/preferences-labels";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.profile");
  return { title: t("title") };
}

/**
 * Onglet « Profil » (maquette v2 01) : réglages à la manière d'iOS (langue, apparence ; icônes dans des carrés de
 * couleur), aide, conditions et confidentialité, espace du personnel.
 */
export default async function ProfilePage() {
  const t = await getTranslations("client.profile");
  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] lg:max-w-[40rem] lg:pt-12">
        <h1 className="text-large-title font-bold">{t("title")}</h1>
        <Preferences labels={await preferencesLabels()} locale={await getLocale()} variant="rows" />
        <ListSection>
          <ListRow
            href="/help"
            prefetch={false}
            icon={
              <ListIcon color="var(--icon-gray)">
                <CircleHelp />
              </ListIcon>
            }
            title={t("help")}
            accessory="chevron"
          />
          <ListRow
            href="/confidentialite"
            prefetch={false}
            icon={
              <ListIcon color="var(--icon-gray)">
                <FileText />
              </ListIcon>
            }
            title={t("legal")}
            accessory="chevron"
          />
        </ListSection>
        <ListSection>
          <ListRow
            href="/login"
            prefetch={false}
            icon={
              <ListIcon color="var(--brand-tile)">
                <UserRound />
              </ListIcon>
            }
            title={t("staff")}
            accessory="chevron"
          />
        </ListSection>
        <p className="text-center text-footnote text-label-secondary">
          {t("noAccount")}
          <br />
          {t("signature")}
        </p>
      </div>
      <ClientTabs active="profile" />
    </main>
  );
}
