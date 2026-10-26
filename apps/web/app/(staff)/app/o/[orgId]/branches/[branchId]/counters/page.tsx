import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DoorOpen, Plus } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("counters");
  return { title: t("title") };
}

const KIND_ORDER = ["accueil", "cabinet", "guichet", "laboratoire", "caisse"] as const;

export default async function CountersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; branchId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, branchId } = await params;
  const { saved } = await searchParams;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("counters");
  const tk = await getTranslations("counterKinds");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data: counters } = await supabase
    .from("counters")
    .select("id, kind, number, label, active, counter_services(service:services(prefix)), practitioner:practitioners(title, display_name)")
    .eq("branch_id", branchId)
    .order("number");
  const sorted = (counters ?? []).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.number - b.number);
  const base = `/app/o/${orgId}/branches/${branchId}`;

  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={branch.name} back={{ href: base, label: branch.name }}>
      <SavedNotice show={!!saved} />
      {sorted.length ? (
        <ListSection>
          {sorted.map((c) => {
            const prefixes = c.counter_services.map((cs) => cs.service?.prefix).filter(Boolean).join(", ");
            const practitioner = c.practitioner ? [c.practitioner.title, c.practitioner.display_name].filter(Boolean).join(" ") : null;
            return (
              <ListRow
                key={c.id}
                href={`${base}/counters/${c.id}`}
                icon={
                  <ListIcon color="var(--brand-tile)">
                    <DoorOpen />
                  </ListIcon>
                }
                title={<span className="font-semibold">{`${tk(c.kind)} ${c.number}`}</span>}
                subtitle={[c.label ?? practitioner, prefixes].filter(Boolean).join(" · ") || undefined}
                accessory={c.active ? "chevron" : <Badge>{ta("inactive")}</Badge>}
              />
            );
          })}
        </ListSection>
      ) : (
        <p className="rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-8 text-center text-body text-label-secondary">{t("empty")}</p>
      )}
      {canManage ? (
        <Button asChild block variant={sorted.length ? "tinted" : "filled"}>
          <Link href={`${base}/counters/new`}>
            <Plus aria-hidden className="size-5" />
            {t("new")}
          </Link>
        </Button>
      ) : null}
    </AdminPage>
  );
}
