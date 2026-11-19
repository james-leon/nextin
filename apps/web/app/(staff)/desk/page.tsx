import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DoorOpen, Users } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { requireStaffSession } from "@/lib/auth/session";
import { counterName, practitionerName } from "@/lib/desk/counter-name";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("desk");
  return { title: t("title") };
}

/**
 * Choix du poste (maquette v2 20) : pour chaque agence accessible (RLS), l'accueil d'abord, puis les guichets et
 * cabinets avec leur état et leur praticien, en listes groupées. Un agent ne voit que les postes auxquels il a droit.
 */
export default async function DeskIndex() {
  const session = await requireStaffSession("/desk");
  const t = await getTranslations("desk");
  const tk = await getTranslations("counterKinds");
  const tc = await getTranslations("common");
  const ts = await getTranslations("orgNew");
  const supabase = await getSupabaseServerClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, organization:organizations(name), counters(id, kind, number, label, status, active, practitioner:practitioners(title, display_name))")
    .eq("active", true)
    .order("name");

  // Barre latérale du personnel (comme le back-office) : le contenu s'aligne sur les autres pages.
  return (
    <SidebarShell labels={{ open: tc("sidebarShow"), close: tc("sidebarHide") }} sidebar={<StaffSidebar isPlatformAdmin={session.isPlatformAdmin} />}>
      <AdminPage title={t("title")} subtitle={t("subtitle")} back={{ href: "/app", label: ts("back") }}>
        {!branches?.length ? <CalloutCard icon={<DoorOpen />}>{t("noBranch")}</CalloutCard> : null}
        <div className="flex w-full max-w-2xl flex-col gap-7">
          {(branches ?? []).map((b) => {
            const counters = (b.counters ?? []).filter((c) => c.active).sort((x, y) => x.kind.localeCompare(y.kind) || x.number - y.number);
            const header = `${(b.organization as { name: string } | null)?.name ?? ""} · ${b.name}`;
            return (
              <section key={b.id} aria-label={header} className="flex flex-col gap-5">
                <ListSection header={header}>
                  <ListRow
                    href={`/desk/reception/${b.id}`}
                    icon={<ListIcon color="var(--brand-tile)"><Users /></ListIcon>}
                    title={t("reception")}
                    subtitle={t("receptionHint")}
                    accessory="chevron"
                  />
                </ListSection>
                {counters.length ? (
                  <ListSection header={t("counters")}>
                    {counters.map((c) => (
                      <ListRow
                        key={c.id}
                        href={`/desk/counter/${c.id}`}
                        icon={<ListIcon color="var(--icon-indigo)"><DoorOpen /></ListIcon>}
                        title={counterName(c, (k) => tk(k as "cabinet"))}
                        subtitle={c.practitioner ? practitionerName(c.practitioner) : undefined}
                        detail={<Badge tone={c.status === "open" ? "green" : c.status === "paused" ? "orange" : "neutral"}>{t(`status.${c.status}`)}</Badge>}
                        accessory="chevron"
                      />
                    ))}
                  </ListSection>
                ) : null}
              </section>
            );
          })}
        </div>
      </AdminPage>
    </SidebarShell>
  );
}
