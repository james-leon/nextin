import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Clock, ConciergeBell, DoorOpen, QrCode, SlidersHorizontal, Tag, Tv } from "lucide-react";
import { formatCameroonPhone, openingStatus, summarizeOpeningHours } from "@nextin/shared";
import { localDate } from "@nextin/shared/appointments";
import { AdminPage } from "@/components/admin/admin-page";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { OrgTypeIcon } from "@/components/ui/org-type-icon";
import type { DashboardData } from "@/lib/stats/dashboard";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ orgId: string; branchId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgId, branchId } = await params;
  const { branch } = await getBranch(orgId, branchId);
  return { title: branch.name };
}

/**
 * Fiche d'une agence (maquette v2 17) : photo (ou icône du secteur) avec l'état d'ouverture, adresse et « Modifier » ;
 * structure (services, guichets et cabinets, horaires) ; fonctionnement (QR code, écrans, réglages de la file) ; trois
 * chiffres du jour (statistiques anonymes du tableau de bord). « Ouvrir les postes » mène à l'accueil de l'agence.
 */
export default async function BranchPage({ params, searchParams }: Props) {
  const { orgId, branchId } = await params;
  const { saved } = await searchParams;
  const { ctx, branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("branches");
  const th = await getTranslations("hours");
  const td = await getTranslations("desk");
  const tv = await getTranslations("displays");
  const tw = await getTranslations("weekdaysShort");
  const supabase = await getSupabaseServerClient();
  const today = localDate(new Date(), branch.timezone);
  const [services, counters, hours, qr, displays, stats] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    supabase.from("counters").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("branch_id", branchId).order("weekday"),
    supabase.from("qr_codes").select("short_code").eq("branch_id", branchId).is("service_id", null).eq("active", true).maybeSingle(),
    supabase.from("displays").select("last_seen_at").eq("branch_id", branchId).eq("status", "active"),
    // Chiffres du jour : mêmes statistiques anonymes que le tableau de bord (droits vérifiés par la base).
    supabase.rpc("dashboard_stats", {
      p_org: orgId,
      p_branch: branchId,
      p_from: today,
      p_to: today,
      p_compare_from: today,
      p_compare_to: today,
    }),
  ]);
  const base = `/app/o/${orgId}/branches/${branchId}`;
  const now = new Date();
  const status = openingStatus(hours.data ?? [], now, branch.timezone);
  const online = (displays.data ?? []).filter((d) => d.last_seen_at && now.getTime() - new Date(d.last_seen_at).getTime() < 2 * 60_000).length;
  const day = stats.error ? null : (stats.data as unknown as DashboardData | null);
  const openCounters = day?.counters.filter((c) => c.status !== "closed").length ?? 0;
  const photo = branch.photo_updated_at
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branch-photos/${orgId}/${branchId}/cover.webp?v=${new Date(branch.photo_updated_at).getTime()}`
    : null;
  const shortHours = summarizeOpeningHours(hours.data ?? [], (d) => tw(String(d) as "1"), th("closed"));

  return (
    <AdminPage
      inSplit
      title={branch.name}
      eyebrow={t("eyebrow")}
      back={{ href: `/app/o/${orgId}/branches`, label: t("title") }}
      trailing={
        <Button asChild variant="tinted" size="md">
          <Link href={`/desk/reception/${branchId}`}>
            <ConciergeBell aria-hidden className="size-5" />
            {td("open")}
          </Link>
        </Button>
      }
    >
      <SavedNotice show={!!saved} />
      {/* Deux colonnes dès que le panneau de détail est assez large : la fiche à gauche, le fonctionnement à droite. */}
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-2 @2xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label={t("info")} className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary">
            <div className="relative aspect-[16/9] bg-fill-tertiary">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- photo publique déjà recadrée (16:9, webp)
                <img src={photo} alt={t("photoAlt")} className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center" style={{ background: "var(--accent-tint)" }}>
                  <span aria-hidden className="text-accent-on-tint [&_svg]:size-14 [&_svg]:stroke-[1.25]">
                    <OrgTypeIcon type={ctx.org.type} />
                  </span>
                </span>
              )}
              <span className="absolute top-3 left-3">
                <Badge shape="pill" tone={status.open ? "green" : "neutral"} dot className="bg-grouped-secondary">
                  {status.open ? t("openUntil", { time: status.until }) : t("closedNow")}
                </Badge>
              </span>
            </div>
            <div className="flex items-start gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-headline text-balance">{branch.address || branch.name}</p>
                <p className="text-footnote text-label-secondary">
                  {[branch.city, branch.phone_e164 ? formatCameroonPhone(branch.phone_e164) : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage ? (
                <Button asChild variant="tinted" size="md">
                  <Link href={`${base}/edit`}>{t("edit")}</Link>
                </Button>
              ) : null}
            </div>
          </section>
          <ListSection header={t("structure")}>
            <ListRow
              href={`${base}/services`}
              icon={<ListIcon color="var(--accent-fill)"><Tag /></ListIcon>}
              title={t("servicesTitle")}
              detail={<span className="tabular">{services.count ?? 0}</span>}
              accessory="chevron"
            />
            <ListRow
              href={`${base}/counters`}
              icon={<ListIcon color="var(--icon-indigo)"><DoorOpen /></ListIcon>}
              title={t("countersTitle")}
              detail={<span className="tabular">{counters.count ?? 0}</span>}
              accessory="chevron"
            />
            <ListRow
              href={`${base}/hours`}
              icon={<ListIcon color="var(--orange-fill)"><Clock /></ListIcon>}
              title={t("hoursShort")}
              subtitle={shortHours}
              accessory="chevron"
            />
          </ListSection>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ListSection header={t("operations")}>
            <ListRow
              href={`${base}/qr`}
              icon={<ListIcon color="var(--brand-tile)"><QrCode /></ListIcon>}
              title={t("qrShort")}
              subtitle={qr.data ? t("qrCode", { code: qr.data.short_code }) : undefined}
              accessory="chevron"
            />
            <ListRow
              href={`${base}/displays`}
              icon={<ListIcon color="var(--green-fill)"><Tv /></ListIcon>}
              title={tv("title")}
              detail={(displays.data?.length ?? 0) > 0 ? t("displaysOnline", { count: online }) : undefined}
              accessory="chevron"
            />
            <ListRow
              href={`${base}/settings`}
              icon={<ListIcon color="var(--icon-gray)"><SlidersHorizontal /></ListIcon>}
              title={t("settings")}
              accessory="chevron"
            />
          </ListSection>
          {day ? (
            <ListSection header={t("today")} footer={t("todayFooter")}>
              <ListRow title={t("todayIssued")} detail={<span className="font-semibold text-label tabular">{day.totals.issued}</span>} />
              <ListRow
                title={t("todayWait")}
                detail={
                  <span className="font-semibold text-label tabular">
                    {day.totals.wait_avg_seconds == null ? "—" : t("minutesShort", { count: Math.round(day.totals.wait_avg_seconds / 60) })}
                  </span>
                }
              />
              <ListRow
                title={t("todayCounters")}
                detail={<span className="font-semibold text-label tabular">{t("ofTotal", { done: openCounters, total: counters.count ?? 0 })}</span>}
              />
            </ListSection>
          ) : null}
        </div>
      </div>
    </AdminPage>
  );
}
