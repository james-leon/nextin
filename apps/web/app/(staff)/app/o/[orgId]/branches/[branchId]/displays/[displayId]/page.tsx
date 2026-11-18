import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DisplayForm } from "@/components/admin/display-forms";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { Badge } from "@/components/ui/badge";
import { ListRow, ListSection } from "@/components/ui/list";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { revokeDisplay, updateDisplay } from "../../../../_actions/displays";

type Props = { params: Promise<{ orgId: string; branchId: string; displayId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("displays");
  return { title: t("edit") };
}

export default async function DisplayPage({ params }: Props) {
  const { orgId, branchId, displayId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  if (!/^[0-9a-f-]{36}$/i.test(displayId)) notFound();
  const t = await getTranslations("displays");
  const supabase = await getSupabaseServerClient();
  const [{ data: display }, services] = await Promise.all([
    supabase
      .from("displays")
      .select("id, name, show_ads, last_seen_at, display_services(service_id)")
      .eq("id", displayId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("services").select("id, name, prefix, color").eq("branch_id", branchId).eq("active", true).order("sort_order"),
  ]);
  if (!display) notFound();
  const name = display.name ?? "";
  const locale = await getLocale();
  // Rendu serveur dynamique : l'heure de la requête sert de référence pour « en ligne » (signe de vie chaque minute).
  const now = new Date().getTime();
  const online = !!display.last_seen_at && now - new Date(display.last_seen_at).getTime() < 2 * 60_000;
  const lastSeen = display.last_seen_at
    ? online
      ? t("activeNow")
      : new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: branch.timezone }).format(new Date(display.last_seen_at))
    : t("neverSeen");
  return (
    <AdminPage narrow title={name} eyebrow={`${t("edit")} · ${branch.name}`} back={{ href: `/app/o/${orgId}/branches/${branchId}/displays`, label: t("title") }}>
      <ReadOnlyNotice show={!canManage} />
      {/* Maquette v2 19 : état en direct de l'écran, puis ses réglages (enregistrement automatique). */}
      <ListSection>
        <ListRow
          title={t("stateLabel")}
          detail={
            <Badge shape="pill" tone={online ? "green" : "neutral"}>
              {online ? t("online") : t("offline")}
            </Badge>
          }
        />
        <ListRow title={t("lastActivity")} detail={lastSeen} />
      </ListSection>
      <DisplayForm
        action={updateDisplay.bind(null, orgId, branchId, displayId)}
        services={services.data ?? []}
        initial={{ name, serviceIds: (display.display_services ?? []).map((s) => s.service_id), showAds: display.show_ads }}
        adsHref={`/app/o/${orgId}/ads`}
        disabled={!canManage}
      />
      {canManage ? (
        <ConfirmAction
          action={revokeDisplay.bind(null, orgId, branchId, displayId)}
          variant="destructive-plain"
          label={t("revoke")}
          title={t("revokeTitle", { name })}
          body={t("revokeBody")}
          confirmLabel={t("revoke")}
        />
      ) : null}
    </AdminPage>
  );
}
