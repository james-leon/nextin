import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogOut, Mail } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { AdminPage } from "@/components/admin/admin-page";
import { Preferences } from "@/components/settings/preferences";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { requireStaffSession } from "@/lib/auth/session";
import { safeNextPath } from "@nextin/shared";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

/** Réglages du membre du personnel : apparence (Auto / Clair / Sombre), langue, compte. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireStaffSession("/app/settings");
  const { from } = await searchParams;
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const ta = await getTranslations("auth");
  const back = safeNextPath(from, "/app");

  return (
    <main className="pb-24">
      <AdminPage title={t("title")} back={{ href: back, label: tc("back") }}>
        <ListSection header={t("account")}>
          <ListRow
            icon={
              <ListIcon color="var(--brand-tile)">
                <Mail />
              </ListIcon>
            }
            title={session.email ?? ""}
          />
        </ListSection>
        <Preferences appearanceFooter={t("appearanceFooter")} />
        <form action={signOut}>
          <Button type="submit" block variant="destructive-plain" leadingIcon={<LogOut aria-hidden className="size-5" />}>
            {ta("signOut")}
          </Button>
        </form>
      </AdminPage>
    </main>
  );
}
