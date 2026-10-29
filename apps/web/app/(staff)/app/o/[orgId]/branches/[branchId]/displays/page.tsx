import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone, MonitorPlay, Tv } from "lucide-react";
import { absoluteUrl } from "@nextin/shared";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { CopyButton } from "@/components/admin/copy-button";
import { PairDisplayForm } from "@/components/admin/display-forms";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { pairDisplay, revokeDisplay } from "../../../_actions/displays";

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

  const serviceName = new Map((services.data ?? []).map((sv) => [sv.id, sv.name]));
  const shown = (d: { display_services: { service_id: string }[] | null }) => {
    const ids = (d.display_services ?? []).map((x) => x.service_id);
    return ids.length ? ids.map((id) => serviceName.get(id)).filter(Boolean).join(" · ") : t("allServices");
  };

  return (
    <AdminPage title={t("title")} eyebrow={branch.name} back={{ href: base, label: branch.name }}>
      <SavedNotice show={!!saved || !!paired || !!revoked} message={paired ? t("paired") : revoked ? t("revoked") : undefined} />
      {/* Ordinateur : écrans en grille de cartes à gauche, appairage à droite. */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <section aria-labelledby="displays-title" className="flex flex-col gap-2">
            <h2 id="displays-title" className="px-4 text-footnote uppercase text-label-secondary">
              {t("listHeader")}
            </h2>
            {displays.data?.length ? (
              <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {displays.data.map((d) => {
                  const offline = seen(d.last_seen_at);
                  return (
                    <li key={d.id} className="squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card">
                      <div className="flex items-start gap-3">
                        <ListIcon color="var(--brand-tile)">
                          <Tv />
                        </ListIcon>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-headline">{d.name ?? ""}</span>
                          <span className="line-clamp-2 text-subheadline text-label-secondary">{shown(d)}</span>
                        </div>
                        {offline ? <Badge>{t("offline")}</Badge> : <Badge tone="green">{t("online")}</Badge>}
                      </div>
                      <p className="text-footnote text-label-secondary">
                        {t("lastActivity")} : {offline ?? t("activeNow")}
                      </p>
                      <div className="-mb-2 flex flex-wrap items-center justify-end gap-1">
                        <Button asChild variant="plain" size="md">
                          <Link href={`${base}/displays/${d.id}`} aria-label={`${t("manage")} · ${d.name ?? ""}`}>
                            {t("manage")}
                          </Link>
                        </Button>
                        {canManage ? (
                          <ConfirmAction
                            action={revokeDisplay.bind(null, orgId, branchId, d.id)}
                            label={t("revoke")}
                            title={t("revokeTitle", { name: d.name ?? "" })}
                            body={t("revokeBody")}
                            confirmLabel={t("revoke")}
                            variant="destructive-plain"
                            block={false}
                            size="md"
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              // État vide centré (revue responsive R6) : l'appairage, à côté, est l'action principale.
              <div className="squircle flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-12 text-center">
                <span aria-hidden className="squircle flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint">
                  <Tv className="size-8 stroke-[1.5]" />
                </span>
                <p className="text-title3 font-semibold">{t("emptyTitle")}</p>
                <p className="max-w-md text-body text-label-secondary">{t("emptyBody")}</p>
              </div>
            )}
          </section>
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
        </div>
        {canManage ? (
          <section aria-labelledby="pair-title" className="flex flex-col gap-4 lg:sticky lg:top-24">
            <h2 id="pair-title" className="px-1 text-title3 font-semibold">
              {t("pairHeader")}
            </h2>
            <CalloutCard icon={<MonitorPlay />} tone="accent">
              {t("intro")}
              <span className="mt-2 block font-semibold break-all">{tvUrl}</span>
            </CalloutCard>
            <CopyButton value={tvUrl} label={t("tvUrl")} copiedLabel={tq("copied")} variant="gray" />
            <PairDisplayForm action={pairDisplay.bind(null, orgId, branchId)} services={services.data ?? []} />
          </section>
        ) : null}
      </div>
    </AdminPage>
  );
}
