import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Layers } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { isLocale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { PlatformNav } from "@/components/platform/platform-sidebar";
import { Badge } from "@/components/ui/badge";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("plansTitle") };
}

/** Formules proposées (prix, agences incluses) ; un toucher pour les modifier. */
export default async function PlansPage() {
  const t = await getTranslations("platform");
  const tb = await getTranslations("billing");
  const ta = await getTranslations("admin");
  const locale = await getLocale();
  const supabase = await getSupabaseServerClient();
  const { data: plans } = await supabase.from("plans").select("id, name, base_price_xaf, included_branches, active").order("sort_order");
  return (
    <AdminPage narrow title={t("plansTitle")} eyebrow={t("title")}>
      <PlatformNav variant="inline" />
      <ListSection footer={t("planNote")}>
        {(plans ?? []).map((p) => (
          <ListRow
            key={p.id}
            href={`/admin/plans/${p.id}`}
            icon={
              <ListIcon color="var(--accent-fill)">
                <Layers />
              </ListIcon>
            }
            title={<span className="font-semibold">{p.name}</span>}
            subtitle={`${formatXaf(p.base_price_xaf, isLocale(locale) ? locale : "fr")} ${tb("perMonth")} · ${tb("includedBranches", { count: p.included_branches })}`}
            detail={p.active ? undefined : <Badge>{ta("inactive")}</Badge>}
            accessory="chevron"
          />
        ))}
      </ListSection>
    </AdminPage>
  );
}
