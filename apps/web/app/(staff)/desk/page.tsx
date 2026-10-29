import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, ConciergeBell, DoorOpen } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { requireStaffSession } from "@/lib/auth/session";
import { counterName, practitionerName } from "@/lib/desk/counter-name";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("desk");
  return { title: t("title") };
}

/** Tuile d'un poste : pictogramme, nom, praticien ou consigne, statut — une cible tactile entière. */
function DeskTile({
  href,
  icon,
  color,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle?: string | null;
  badge?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="pressable squircle flex h-full min-h-20 items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card transition-colors hover:bg-fill-tertiary/50"
      >
        <span
          aria-hidden
          className="squircle flex size-11 shrink-0 items-center justify-center rounded-[11px] text-white [&_svg]:size-6 [&_svg]:stroke-[1.75]"
          style={{ background: color }}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-headline">{title}</span>
          {subtitle ? <span className="line-clamp-2 text-subheadline text-label-secondary">{subtitle}</span> : null}
        </span>
        {badge}
        <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
      </Link>
    </li>
  );
}

/**
 * Choix du poste : pour chaque agence accessible (RLS), l'accueil puis les guichets et cabinets en grille de tuiles
 * (une colonne sur téléphone, deux sur tablette, trois sur ordinateur), avec statut et praticien.
 */
export default async function DeskIndex() {
  const session = await requireStaffSession("/desk");
  const t = await getTranslations("desk");
  const tk = await getTranslations("counterKinds");
  const tc = await getTranslations("common");
  const supabase = await getSupabaseServerClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, organization:organizations(name), counters(id, kind, number, label, status, active, practitioner:practitioners(title, display_name))")
    .eq("active", true)
    .order("name");

  // Barre latérale du personnel (comme le back-office) : le contenu s'aligne sur les autres pages.
  return (
    <SidebarShell labels={{ open: tc("sidebarShow"), close: tc("sidebarHide") }} sidebar={<StaffSidebar isPlatformAdmin={session.isPlatformAdmin} />}>
      <AdminPage title={t("title")} subtitle={t("subtitle")} back={{ href: "/app", label: tc("back") }}>
        {!branches?.length ? <CalloutCard icon={<DoorOpen />}>{t("noBranch")}</CalloutCard> : null}
        {(branches ?? []).map((b) => {
          const counters = (b.counters ?? []).filter((c) => c.active).sort((x, y) => x.kind.localeCompare(y.kind) || x.number - y.number);
          const header = `${(b.organization as { name: string } | null)?.name ?? ""} · ${b.name}`;
          return (
            <section key={b.id} aria-label={header} className="flex flex-col gap-2">
              <h2 className="px-4 text-footnote uppercase text-label-secondary">{header}</h2>
              <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DeskTile
                  href={`/desk/reception/${b.id}`}
                  icon={<ConciergeBell />}
                  color="var(--accent-fill)"
                  title={t("reception")}
                  subtitle={t("receptionHint")}
                />
                {counters.map((c) => (
                  <DeskTile
                    key={c.id}
                    href={`/desk/counter/${c.id}`}
                    icon={<DoorOpen />}
                    color="var(--brand-tile)"
                    title={counterName(c, (k) => tk(k as "cabinet"))}
                    subtitle={c.practitioner ? practitionerName(c.practitioner) : null}
                    badge={<Badge tone={c.status === "open" ? "green" : c.status === "paused" ? "orange" : "neutral"}>{t(`status.${c.status}`)}</Badge>}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </AdminPage>
    </SidebarShell>
  );
}
