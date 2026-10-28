import { getTranslations } from "next-intl/server";
import { Building2, CheckCircle2, Circle, DoorOpen, QrCode, Stethoscope, UsersRound } from "lucide-react";
import { SERVICE_COLORS } from "@nextin/shared";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { StatCard } from "@/components/ui/stat-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Étapes de démarrage d'un établissement (agence, services, guichets, QR code, personnel). */
export async function setupSteps(orgId: string) {
  const supabase = await getSupabaseServerClient();
  const count = (table: "branches" | "services" | "counters" | "memberships") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  const [branches, services, counters, members, firstBranch, invites] = await Promise.all([
    count("branches"),
    count("services"),
    count("counters"),
    count("memberships"),
    supabase.from("branches").select("id").eq("organization_id", orgId).order("sort_order").limit(1).maybeSingle(),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);
  const n = {
    branches: branches.count ?? 0,
    services: services.count ?? 0,
    counters: counters.count ?? 0,
    members: members.count ?? 0,
  };
  const b = firstBranch.data?.id;
  const root = `/app/o/${orgId}`;
  const steps = [
    { key: "stepBranch", done: n.branches > 0, href: `${root}/branches`, icon: <Building2 />, color: "var(--brand-tile)" },
    { key: "stepServices", done: n.services > 0, href: b ? `${root}/branches/${b}/services` : `${root}/branches`, icon: <Stethoscope />, color: "var(--accent-fill)" },
    { key: "stepCounters", done: n.counters > 0, href: b ? `${root}/branches/${b}/counters` : `${root}/branches`, icon: <DoorOpen />, color: SERVICE_COLORS.green },
    { key: "stepQr", done: false, href: b ? `${root}/branches/${b}/qr` : `${root}/branches`, icon: <QrCode />, color: SERVICE_COLORS.purple },
    { key: "stepStaff", done: n.members > 1 || (invites.count ?? 0) > 0, href: `${root}/staff`, icon: <UsersRound />, color: SERVICE_COLORS.ochre },
  ] as const;
  // Le QR code n'est pas mesurable : la configuration est jugée complète quand le reste est fait.
  const done = steps.filter((s) => s.done).length;
  return { n, steps, done, total: steps.length - 1, complete: steps.every((s) => s.done || s.key === "stepQr") };
}

/** Compteurs et liste des étapes de démarrage (page « Démarrage », et vue d'ensemble sans tableau de bord). */
export async function SetupOverview({ orgId }: { orgId: string }) {
  const t = await getTranslations("overview");
  const { n, steps } = await setupSteps(orgId);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("branches")} value={n.branches} />
        <StatCard label={t("services")} value={n.services} />
        <StatCard label={t("counters")} value={n.counters} />
        <StatCard label={t("staff")} value={n.members} />
      </div>
      <ListSection header={t("checklistTitle")} footer={t("checklistFooter")}>
        {steps.map((s) => (
          <ListRow
            key={s.key}
            href={s.href}
            icon={<ListIcon color={s.color}>{s.icon}</ListIcon>}
            title={t(s.key)}
            detail={
              s.done ? (
                <span className="inline-flex items-center gap-1 text-green-text">
                  <CheckCircle2 aria-hidden className="size-4 stroke-2" />
                  {t("done")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Circle aria-hidden className="size-4 stroke-2" />
                  {t("todo")}
                </span>
              )
            }
            accessory="chevron"
          />
        ))}
      </ListSection>
    </>
  );
}

/** Navigation de l'établissement sur téléphone et tablette (la barre latérale apparaît à partir de `lg`). */
export async function MobileOrgNav({ orgId }: { orgId: string }) {
  const ta = await getTranslations("admin");
  const root = `/app/o/${orgId}`;
  return (
    <nav aria-label={ta("navLabel")} className="lg:hidden">
      <ListSection>
        <ListRow href={`${root}/branches`} icon={<ListIcon color="var(--brand-tile)"><Building2 /></ListIcon>} title={ta("nav.branches")} accessory="chevron" />
        <ListRow href={`${root}/practitioners`} icon={<ListIcon color="var(--accent-fill)"><Stethoscope /></ListIcon>} title={ta("nav.practitioners")} accessory="chevron" />
        <ListRow href={`${root}/staff`} icon={<ListIcon color={SERVICE_COLORS.ochre}><UsersRound /></ListIcon>} title={ta("nav.staff")} accessory="chevron" />
      </ListSection>
    </nav>
  );
}
