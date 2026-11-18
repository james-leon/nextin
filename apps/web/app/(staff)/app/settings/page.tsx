import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Bell, ShieldCheck } from "lucide-react";
import { initialsOf } from "@/lib/text/initials";
import { signOut } from "@/app/(auth)/actions";
import { AdminPage } from "@/components/admin/admin-page";
import { Preferences } from "@/components/settings/preferences";
import { preferencesLabels } from "@/lib/i18n/preferences-labels";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { requireStaffSession } from "@/lib/auth/session";
import { safeNextPath } from "@nextin/shared";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/**
 * « Mon compte » (maquette v2 07), le même pour tous les rôles : profil, sécurité (mot de passe, double
 * authentification, appareils connectés), notifications, langue, apparence et déconnexion.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireStaffSession("/app/settings");
  const { from } = await searchParams;
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const ta = await getTranslations("auth");
  const tm = await getTranslations("mfa");
  const back = safeNextPath(from, "/app");

  const name = session.fullName ?? session.email ?? "";
  return (
    <main className="pb-24">
      <AdminPage narrow title={t("myAccount")} back={{ href: back, label: tc("back") }}>
        <section aria-label={t("account")} className="squircle flex items-center gap-4 rounded-[var(--radius-lg)] bg-grouped-secondary px-4 py-3.5">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-title3 font-semibold text-on-accent"
          >
            {initialsOf(name)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-title3 font-semibold">{name}</span>
            {session.fullName && session.email ? <span className="truncate text-subheadline text-label-secondary">{session.email}</span> : null}
          </span>
        </section>
        <ListSection>
          <ListRow
            href="/app/settings/security"
            icon={
              <ListIcon color="var(--icon-indigo)">
                <ShieldCheck />
              </ListIcon>
            }
            title={t("security")}
            subtitle={tm("row")}
            detail={<span className={session.mfa.enrolled ? "text-green-text" : undefined}>{session.mfa.enrolled ? tm("on") : tm("off")}</span>}
            accessory="chevron"
          />
          <ListRow
            href="/app/settings/notifications"
            icon={
              <ListIcon color="var(--orange-fill)">
                <Bell />
              </ListIcon>
            }
            title={t("notifications")}
            accessory="chevron"
          />
        </ListSection>
        <Preferences variant="rows" labels={await preferencesLabels(t("appearanceFooter"))} locale={await getLocale()} />
        <form action={signOut} className="squircle overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary">
          <button type="submit" className="pressable flex min-h-11 w-full items-center justify-center px-4 py-3 text-body text-red-text">
            {ta("signOut")}
          </button>
        </form>
      </AdminPage>
    </main>
  );
}
