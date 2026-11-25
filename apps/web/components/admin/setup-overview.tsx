import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Building2, Check, CreditCard, Megaphone, Stethoscope, UsersRound } from "lucide-react";
import { SERVICE_COLORS } from "@nextin/shared";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { StatCard, StatGroup } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SetupKey = "stepBranch" | "stepServices" | "stepCounters" | "stepQr" | "stepStaff" | "stepDisplay";
export type SetupStep = { key: SetupKey; done: boolean; href: string; detail: string | null };

/**
 * Six étapes de démarrage d'un établissement (maquette v2 19), dans l'ordre de la mise en place : agence, services,
 * guichets et cabinets, QR code imprimé, équipe invitée, écran TV appairé. Chacune est mesurée sur les données ; le QR
 * code compte comme fait dès que ses supports ont été téléchargés (`onboarding_step` ≥ 4, posé par la route PDF).
 * La mise en place peut être terminée dès que les étapes indispensables sont faites (QR code et écran facultatifs).
 */
export async function setupSteps(orgId: string, onboardingStep = 0) {
  const supabase = await getSupabaseServerClient();
  const t = await getTranslations("overview");
  const count = (table: "branches" | "services" | "counters" | "memberships" | "displays") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  const [branches, services, counters, members, firstBranch, invites, displays] = await Promise.all([
    count("branches"),
    count("services"),
    count("counters"),
    count("memberships"),
    supabase.from("branches").select("id, name").eq("organization_id", orgId).order("sort_order").limit(1).maybeSingle(),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    count("displays"),
  ]);
  const n = {
    branches: branches.count ?? 0,
    services: services.count ?? 0,
    counters: counters.count ?? 0,
    members: members.count ?? 0,
    invites: invites.count ?? 0,
    displays: displays.count ?? 0,
  };
  const b = firstBranch.data?.id;
  const root = `/app/o/${orgId}`;
  const inBranch = (path: string) => (b ? `${root}/branches/${b}/${path}` : `${root}/branches`);
  const steps: SetupStep[] = [
    { key: "stepBranch", done: n.branches > 0, href: `${root}/branches`, detail: firstBranch.data?.name ?? null },
    { key: "stepServices", done: n.services > 0, href: inBranch("services"), detail: t("countServices", { count: n.services }) },
    { key: "stepCounters", done: n.counters > 0, href: inBranch("counters"), detail: t("countCounters", { count: n.counters }) },
    { key: "stepQr", done: onboardingStep >= 4, href: inBranch("qr"), detail: t("qrPrinted") },
    { key: "stepStaff", done: n.members > 1 || n.invites > 0, href: `${root}/staff`, detail: t("countMembers", { count: n.members + n.invites }) },
    { key: "stepDisplay", done: n.displays > 0, href: inBranch("displays"), detail: t("countDisplays", { count: n.displays }) },
  ];
  // Le QR code et l'écran TV sont facultatifs : la mise en place peut être terminée sans eux.
  const optional = (key: SetupKey) => key === "stepQr" || key === "stepDisplay";
  const done = steps.filter((s) => s.done).length;
  return {
    n,
    steps,
    done,
    total: steps.length,
    allDone: done === steps.length,
    complete: steps.every((s) => s.done || optional(s.key)),
  };
}

/**
 * Démarrage (maquette v2 19) : progression « Configuration : 3 étapes sur 6 », puis une liste groupée où les étapes
 * faites passent en gris avec une coche verte et « Fait », la suivante en gras avec sa description et le seul bouton
 * de la page (« Commencer »), les autres « À faire ».
 */
export async function SetupChecklist({ orgId, onboardingStep }: { orgId: string; onboardingStep: number }) {
  const t = await getTranslations("overview");
  const { steps, done, total } = await setupSteps(orgId, onboardingStep);
  const next = steps.find((s) => !s.done)?.key;
  const percent = Math.round((done / total) * 100);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-headline">{t("progress", { done, total })}</p>
          <p className="text-subheadline text-label-secondary tabular">{percent} %</p>
        </div>
        <ProgressBar value={done / total} label={t("progress", { done, total })} />
      </div>
      <ListSection footer={t("checklistFooter")}>
        {steps.map((s, i) => {
          const isNext = s.key === next;
          const marker = s.done ? (
            <span aria-hidden className="flex size-[1.625rem] items-center justify-center rounded-full bg-green text-on-accent">
              <Check className="size-4 stroke-[3]" />
            </span>
          ) : (
            <span
              aria-hidden
              className={
                isNext
                  ? "flex size-[1.625rem] items-center justify-center rounded-full bg-primary text-footnote font-semibold text-on-accent"
                  : "flex size-[1.625rem] items-center justify-center rounded-full text-footnote font-semibold border-[1.5px] border-label-tertiary text-label-secondary"
              }
            >
              {i + 1}
            </span>
          );
          const title = <span className={s.done ? "text-label-secondary" : isNext ? "font-semibold" : undefined}>{t(s.key)}</span>;
          if (isNext) {
            return (
              <ListRow
                key={s.key}
                icon={marker}
                title={title}
                subtitle={t(`${s.key}Hint`)}
                trailing={
                  <Button asChild size="md">
                    <Link href={s.href} aria-label={`${t("start")} · ${t(s.key)}`}>
                      {t("start")}
                    </Link>
                  </Button>
                }
              />
            );
          }
          return (
            <ListRow
              key={s.key}
              href={s.href}
              icon={marker}
              title={title}
              subtitle={s.done ? (s.detail ?? undefined) : undefined}
              detail={
                <Badge shape="pill" tone={s.done ? "green" : "neutral"}>
                  {s.done ? t("done") : t("todo")}
                </Badge>
              }
              accessory={s.done ? undefined : "chevron"}
            />
          );
        })}
      </ListSection>
    </div>
  );
}

/** Compteurs et liste des étapes de démarrage (vue d'ensemble d'un établissement sans agence). */
export async function SetupOverview({ orgId, onboardingStep = 0 }: { orgId: string; onboardingStep?: number }) {
  const t = await getTranslations("overview");
  const { n } = await setupSteps(orgId, onboardingStep);
  return (
    <>
      <StatGroup>
        <StatCard label={t("branches")} value={n.branches} />
        <StatCard label={t("services")} value={n.services} />
        <StatCard label={t("counters")} value={n.counters} />
        <StatCard label={t("staff")} value={n.members} />
      </StatGroup>
      <SetupChecklist orgId={orgId} onboardingStep={onboardingStep} />
    </>
  );
}

/** Navigation de l'établissement sur téléphone (barre latérale repliable sur tablette, fixe à partir de `lg`). */
export async function MobileOrgNav({ orgId }: { orgId: string }) {
  const ta = await getTranslations("admin");
  const ctx = await getOrgContext(orgId);
  const root = `/app/o/${orgId}`;
  return (
    <nav aria-label={ta("navLabel")} className="md:hidden">
      <ListSection>
        <ListRow href={`${root}/branches`} icon={<ListIcon color="var(--brand-tile)"><Building2 /></ListIcon>} title={ta("nav.branches")} accessory="chevron" />
        <ListRow href={`${root}/practitioners`} icon={<ListIcon color="var(--accent-fill)"><Stethoscope /></ListIcon>} title={ta("nav.practitioners")} accessory="chevron" />
        <ListRow href={`${root}/staff`} icon={<ListIcon color={SERVICE_COLORS.ochre}><UsersRound /></ListIcon>} title={ta("nav.staff")} accessory="chevron" />
        {ctx.canManageOrg ? (
          <>
            <ListRow href={`${root}/ads`} icon={<ListIcon color={SERVICE_COLORS.rose}><Megaphone /></ListIcon>} title={ta("nav.ads")} accessory="chevron" />
            <ListRow href={`${root}/billing`} icon={<ListIcon color={SERVICE_COLORS.green}><CreditCard /></ListIcon>} title={ta("nav.billing")} accessory="chevron" />
          </>
        ) : null}
      </ListSection>
    </nav>
  );
}
