import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone, MonitorPlay, Tv } from "lucide-react";
import { absoluteUrl } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { CopyButton } from "@/components/admin/copy-button";
import { PairDisplayForm } from "@/components/admin/display-forms";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { pairDisplay } from "../../../_actions/displays";

type Props = { params: Promise<{ orgId: string; branchId: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Un écran qui a donné signe de vie depuis moins de 2 minutes est « en ligne » (il se manifeste chaque minute). */
const ONLINE_MS = 2 * 60_000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("displays");
  return { title: t("title") };
}

export default async function DisplaysPage({ params, searchParams }: Props) {
  const { orgId, branchId } = await params;
  const { saved, paired, revoked } = await searchParams;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("displays");
  const tq = await getTranslations("qr");
  const locale = await getLocale();
  const supabase = await getSupabaseServerClient();
  const [displays, services] = await Promise.all([
    supabase
      .from("displays")
      .select("id, name, last_seen_at, display_services(service_id)")
      .eq("branch_id", branchId)
      .eq("status", "active")
      .order("name"),
    supabase.from("services").select("id, name, prefix, color").eq("branch_id", branchId).eq("active", true).order("sort_order"),
  ]);
  const base = `/app/o/${orgId}/branches/${branchId}`;
  const tvUrl = absoluteUrl("/tv");
  // Rendu serveur dynamique : l'heure de la requête sert de référence pour « en ligne ».
  const now = new Date().getTime();
  const seen = (iso: string | null) =>
    !iso
      ? t("neverSeen")
      : now - new Date(iso).getTime() < ONLINE_MS
        ? null
        : t("seenAt", {
            date: new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: branch.timezone }).format(new Date(iso)),
          });

  return (
    <AdminPage narrow title={t("title")} eyebrow={branch.name} back={{ href: base, label: branch.name }}>
      <SavedNotice show={!!saved || !!paired || !!revoked} message={paired ? t("paired") : revoked ? t("revoked") : undefined} />
      <ListSection header={t("listHeader")} footer={displays.data?.length ? undefined : t("none")}>
        {(displays.data ?? []).map((d) => {
          const offline = seen(d.last_seen_at);
          return (
            <ListRow
              key={d.id}
              href={`${base}/displays/${d.id}`}
              icon={
                <ListIcon color="var(--brand-tile)">
                  <Tv />
                </ListIcon>
              }
              title={d.name ?? ""}
              subtitle={t("servicesCount", { count: d.display_services?.length ?? 0 })}
              detail={offline ? <span className="text-subheadline">{offline}</span> : <Badge tone="green">{t("online")}</Badge>}
              accessory="chevron"
            />
          );
        })}
      </ListSection>
      <ListSection>
        <ListRow
          href={`${base}/displays/announcements`}
          icon={
            <ListIcon color="var(--orange-fill)">
              <Megaphone />
            </ListIcon>
          }
          title={t("announcements")}
          subtitle={t("announcementsHint")}
          accessory="chevron"
        />
      </ListSection>
      <ReadOnlyNotice show={!canManage} />
      {canManage ? (
        <>
          <h2 className="px-1 text-title3 font-semibold">{t("pairHeader")}</h2>
          <CalloutCard icon={<MonitorPlay />} tone="accent">
            {t("intro")}
            <span className="mt-2 block font-semibold break-all">{tvUrl}</span>
          </CalloutCard>
          <CopyButton value={tvUrl} label={t("tvUrl")} copiedLabel={tq("copied")} variant="gray" />
          <PairDisplayForm action={pairDisplay.bind(null, orgId, branchId)} services={services.data ?? []} />
        </>
      ) : null}
    </AdminPage>
  );
}
