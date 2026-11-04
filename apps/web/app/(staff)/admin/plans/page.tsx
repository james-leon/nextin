import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Layers, MessageCircle, Plus, Ticket } from "lucide-react";
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
  const [{ data: plans }, { data: packs }] = await Promise.all([
    supabase.from("plans").select("id, name, base_price_xaf, included_branches, quote_only, active").order("sort_order"),
    supabase.from("quota_packs").select("id, kind, quantity, price_xaf, name, active").order("sort_order"),
  ]);
  const xaf = (n: number) => formatXaf(n, isLocale(locale) ? locale : "fr");
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
            subtitle={p.quote_only ? tb("quoteOnly") : `${xaf(p.base_price_xaf)} ${tb("perMonth")} · ${tb("includedBranches", { count: p.included_branches })}`}
            detail={p.active ? undefined : <Badge>{ta("inactive")}</Badge>}
            accessory="chevron"
          />
        ))}
      </ListSection>
      <ListSection header={t("packsTitle")} footer={t("packsFooter")}>
        {(packs ?? []).map((k) => (
          <ListRow
            key={k.id}
            href={`/admin/plans/packs/${k.id}`}
            icon={<ListIcon color={k.kind === "tickets" ? "var(--accent-fill)" : "var(--green-fill)"}>{k.kind === "tickets" ? <Ticket /> : <MessageCircle />}</ListIcon>}
            title={k.name}
            subtitle={xaf(k.price_xaf)}
            detail={k.active ? undefined : <Badge>{ta("inactive")}</Badge>}
            accessory="chevron"
          />
        ))}
        <ListRow
          href="/admin/plans/packs/new"
          icon={<ListIcon color="var(--accent-fill)"><Plus /></ListIcon>}
          title={<span className="text-accent-text">{t("packNew")}</span>}
          accessory="chevron"
        />
      </ListSection>
    </AdminPage>
  );
}
