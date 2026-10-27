import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConciergeBell, DoorOpen } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { requireStaffSession } from "@/lib/auth/session";
import { counterName } from "@/lib/desk/counter-name";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("desk");
  return { title: t("title") };
}

/** Choix du poste : accueil ou guichet / cabinet, pour chaque agence accessible (RLS). */
export default async function DeskIndex() {
  await requireStaffSession("/desk");
  const t = await getTranslations("desk");
  const tk = await getTranslations("counterKinds");
  const tc = await getTranslations("common");
  const supabase = await getSupabaseServerClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, organization:organizations(name), counters(id, kind, number, label, status, active)")
    .eq("active", true)
    .order("name");

  return (
    <main className="pb-24">
      <AdminPage title={t("title")} subtitle={t("subtitle")} back={{ href: "/app", label: tc("back") }}>
        {!branches?.length ? <CalloutCard icon={<DoorOpen />}>{t("noBranch")}</CalloutCard> : null}
        {(branches ?? []).map((b) => {
          const counters = (b.counters ?? []).filter((c) => c.active).sort((x, y) => x.kind.localeCompare(y.kind) || x.number - y.number);
          return (
            <ListSection key={b.id} header={`${(b.organization as { name: string } | null)?.name ?? ""} · ${b.name}`}>
              <ListRow
                href={`/desk/reception/${b.id}`}
                icon={
                  <ListIcon color="var(--accent-fill)">
                    <ConciergeBell />
                  </ListIcon>
                }
                title={t("reception")}
                subtitle={t("receptionHint")}
                accessory="chevron"
              />
              {counters.map((c) => (
                <ListRow
                  key={c.id}
                  href={`/desk/counter/${c.id}`}
                  icon={
                    <ListIcon color="var(--brand-tile)">
                      <DoorOpen />
                    </ListIcon>
                  }
                  title={counterName(c, (k) => tk(k as "cabinet"))}
                  detail={<Badge tone={c.status === "open" ? "green" : c.status === "paused" ? "orange" : "neutral"}>{t(`status.${c.status}`)}</Badge>}
                  accessory="chevron"
                />
              ))}
            </ListSection>
          );
        })}
      </AdminPage>
    </main>
  );
}
