import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, Plus } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("branches");
  return { title: t("title") };
}

export default async function BranchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("branches");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, city, address, active, services(count), counters(count)")
    .eq("organization_id", orgId)
    .order("sort_order");

  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}>
      <SavedNotice show={!!saved} />
      {branches?.length ? (
        <ListSection>
          {branches.map((b) => (
            <ListRow
              key={b.id}
              href={`/app/o/${orgId}/branches/${b.id}`}
              icon={
                <ListIcon color="var(--brand-tile)">
                  <Building2 />
                </ListIcon>
              }
              title={<span className="font-semibold">{b.name}</span>}
              subtitle={[b.city, t("servicesCount", { count: b.services[0]?.count ?? 0 }), t("countersCount", { count: b.counters[0]?.count ?? 0 })]
                .filter(Boolean)
                .join(" · ")}
              accessory="chevron"
            />
          ))}
        </ListSection>
      ) : (
        <p className="rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-8 text-center text-body text-label-secondary">{t("empty")}</p>
      )}
      {ctx.canManageOrg ? (
        <Button asChild block variant={branches?.length ? "tinted" : "filled"}>
          <Link href={`/app/o/${orgId}/branches/new`}>
            <Plus aria-hidden className="size-5" />
            {t("new")}
          </Link>
        </Button>
      ) : null}
    </AdminPage>
  );
}
