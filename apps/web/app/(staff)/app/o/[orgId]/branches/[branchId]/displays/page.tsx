import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Tv, Volume2 } from "lucide-react";
import { absoluteUrl } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { PairDisplayForm } from "@/components/admin/display-forms";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { SavedNotice } from "@/components/admin/saved-notice";
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
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[var(--lg-cols)] lg:items-start" style={{ "--lg-cols": "minmax(0,1fr) 24rem" } as React.CSSProperties}>
        <div className="flex min-w-0 flex-col gap-7">
          {/* Maquette v2 19 : une ligne par écran, état en direct dans le sous-titre (vert quand l'écran répond). */}
          {displays.data?.length ? (
            <ListSection header={t("listHeader")}>
              {displays.data.map((d) => {
                const offline = seen(d.last_seen_at);
                return (
                  <ListRow
                    key={d.id}
                    href={`${base}/displays/${d.id}`}
                    icon={
                      <ListIcon color={offline ? "var(--icon-gray)" : "var(--green-fill)"}>
                        <Tv />
                      </ListIcon>
                    }
                    title={d.name ?? ""}
                    subtitle={
                      <>
                        {offline ? (
                          <span>
                            {t("offline")} · {offline}
                          </span>
                        ) : (
                          <>
                            <span className="font-semibold text-green-text">{t("online")}</span> · {shown(d)}
                          </>
                        )}
                      </>
                    }
                    accessory="chevron"
                  />
                );
              })}
            </ListSection>
          ) : (
            // État vide centré (maquette v2 19) : l'appairage, à côté ou dessous, est l'action principale.
            <div className="squircle flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-12 text-center">
              <span aria-hidden className="squircle flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint">
                <Tv className="size-8 stroke-[1.5]" />
              </span>
              <p className="text-title3 font-semibold">{t("emptyTitle")}</p>
              <p className="max-w-md text-body text-label-secondary">{t("emptyBody")}</p>
            </div>
          )}
          <ListSection>
            <ListRow
              href={`${base}/displays/announcements`}
              icon={
                <ListIcon color="var(--red-fill)">
                  <Volume2 />
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
            <PairDisplayForm action={pairDisplay.bind(null, orgId, branchId)} services={services.data ?? []} adsHref={`/app/o/${orgId}/ads`} tvUrl={tvUrl} />
          </section>
        ) : null}
      </div>
    </AdminPage>
  );
}
