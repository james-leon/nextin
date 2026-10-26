import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { formatTicketCode } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ServiceTile } from "@/components/ui/service-tile";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("title") };
}

export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; branchId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, branchId } = await params;
  const { saved } = await searchParams;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("services");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, prefix, color, default_service_seconds, active")
    .eq("branch_id", branchId)
    .order("sort_order")
    .order("prefix");
  const base = `/app/o/${orgId}/branches/${branchId}`;

  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={branch.name} back={{ href: base, label: branch.name }}>
      <SavedNotice show={!!saved} />
      {services?.length ? (
        <ListSection>
          {services.map((s) => (
            <ListRow
              key={s.id}
              href={`${base}/services/${s.id}`}
              icon={<ServiceTile letter={s.prefix} color={s.color} />}
              title={s.name}
              subtitle={`${formatTicketCode(s.prefix, 1)} · ${t("minutes", { count: Math.round(s.default_service_seconds / 60) })}`}
              accessory={s.active ? "chevron" : <Badge>{ta("inactive")}</Badge>}
            />
          ))}
        </ListSection>
      ) : (
        <p className="rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-8 text-center text-body text-label-secondary">{t("empty")}</p>
      )}
      {canManage ? (
        <Button asChild block variant={services?.length ? "tinted" : "filled"}>
          <Link href={`${base}/services/new`}>
            <Plus aria-hidden className="size-5" />
            {t("new")}
          </Link>
        </Button>
      ) : null}
    </AdminPage>
  );
}
