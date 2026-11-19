import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Building2, CheckCircle2, ChevronRight, DoorOpen, Megaphone, Plus, Settings, ShieldCheck } from "lucide-react";
import type { MemberRole } from "@nextin/shared";
import type { Database } from "@nextin/shared/database";
import { sectorColor } from "@/components/ui/org-type-icon";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Logo } from "@/components/ui/logo";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { initialsOf } from "@/lib/text/initials";

type Org = Pick<Database["public"]["Tables"]["organizations"]["Row"], "id" | "name" | "status" | "type">;

const ROLE_ORDER: MemberRole[] = ["org_admin", "branch_manager", "receptionist", "agent"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staff");
  return { title: t("title") };
}

/**
 * « Mes établissements » (maquette v2 16) : le premier écran du personnel, qui sert à entrer dans son établissement.
 * Liste groupée (initiales sur la couleur du secteur, secteur · rôle, « Essai » ou état si besoin), « Créer un
 * établissement » en ligne bleue, accès rapides selon les droits ; colonne de 640 px centrée sur ordinateur.
 * Aucun établissement : une seule action en bleu nuit et le rappel du lien d'invitation.
 */
export default async function StaffHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireStaffSession("/app");
  const { created, joined } = await searchParams;
  const t = await getTranslations("staff");
  const tr = await getTranslations("roles");
  const tt = await getTranslations("orgTypes");
  const ts = await getTranslations("settings");
  const td = await getTranslations("desk");
  const ta = await getTranslations("admin");
  const tads = await getTranslations("ads");

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, organization:organizations(id, name, status, type)")
    .eq("user_id", session.userId)
    .eq("active", true);

  // Un membre peut avoir plusieurs affectations dans un établissement : on garde le rôle le plus large.
  const byOrg = new Map<string, { org: Org; role: MemberRole }>();
  for (const row of data ?? []) {
    const org = row.organization as Org | null;
    if (!org) continue;
    const prev = byOrg.get(org.id);
    if (!prev || ROLE_ORDER.indexOf(row.role) < ROLE_ORDER.indexOf(prev.role)) byOrg.set(org.id, { org, role: row.role });
  }
  const orgs = [...byOrg.values()].sort((a, b) => a.org.name.localeCompare(b.org.name));
  const joinedOrg = joined ? byOrg.get(joined)?.org : undefined;
  // Super admin sans établissement : sa page d'accueil est la console (jamais d'invitation à créer un établissement).
  if (session.isPlatformAdmin && orgs.length === 0) redirect("/admin");

  // Sous-titre : essai en cours (statut d'abonnement, lisible par le personnel) et nombre d'agences visibles.
  const ids = orgs.map((o) => o.org.id);
  const [{ data: subs }, { data: branches }] = ids.length
    ? await Promise.all([
        supabase.from("subscriptions").select("organization_id, status").in("organization_id", ids),
        supabase.from("branches").select("organization_id").in("organization_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const trialing = new Set((subs ?? []).filter((s) => s.status === "trialing").map((s) => s.organization_id));
  const branchCount = new Map<string, number>();
  for (const b of branches ?? []) branchCount.set(b.organization_id, (branchCount.get(b.organization_id) ?? 0) + 1);

  const subtitle = (org: Org, role: MemberRole) =>
    [
      tt(org.type),
      tr(role),
      org.status !== "active" ? t(`status.${org.status}`) : trialing.has(org.id) ? t("trial") : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[40rem] flex-col px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-12 lg:max-w-none lg:px-8">
      {/* En-tête : logo ; réglages (icône sur téléphone, lien et initiales sur ordinateur). */}
      <div className="flex h-11 items-center justify-between lg:h-14">
        <Logo className="h-8" />
        <div className="flex items-center gap-2">
          <Link
            href="/app/settings"
            aria-label={ts("open")}
            title={ts("open")}
            className="pressable inline-flex size-11 items-center justify-center rounded-full text-accent-text lg:hidden"
          >
            <Settings aria-hidden className="size-[1.375rem] stroke-[1.75]" />
          </Link>
          <Button asChild variant="plain" size="md" className="hidden lg:inline-flex">
            <Link href="/app/settings">
              <Settings aria-hidden className="size-5" />
              {ts("open")}
            </Link>
          </Button>
          <span
            aria-hidden
            className="hidden size-8 items-center justify-center rounded-full bg-fill-tertiary text-caption font-semibold text-label lg:flex"
          >
            {initialsOf(session.fullName ?? session.email ?? "")}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[40rem] flex-1 flex-col">
        {orgs.length === 0 ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <h1 className="sr-only">{t("title")}</h1>
            <span className="squircle mb-2 flex size-16 items-center justify-center rounded-[16px] bg-accent-tint text-accent-on-tint">
              <Building2 aria-hidden className="size-8 stroke-[1.5]" />
            </span>
            <h2 className="text-title2 font-bold text-balance">{t("emptyTitle")}</h2>
            <p className="max-w-xs text-body text-label-secondary">{t("emptyBody")}</p>
            <Button asChild className="mt-3">
              <Link href="/app/new">
                <Plus aria-hidden className="size-5" />
                {t("create")}
              </Link>
            </Button>
            {/* Rappel sans JavaScript : un membre invité ouvre le lien reçu par e-mail. */}
            <details className="group mt-1 max-w-xs">
              <summary className="pressable inline-flex min-h-11 cursor-pointer list-none items-center text-subheadline text-accent-text [&::-webkit-details-marker]:hidden">
                {t("invitationLink")}
              </summary>
              <p className="text-footnote text-label-secondary">{t("invitationHint")}</p>
            </details>
          </section>
        ) : (
          <>
            <header className="pt-5 pb-5 lg:pt-10">
              <h1 className="text-large-title font-bold text-balance">{t("title")}</h1>
              <p className="mt-1 truncate text-subheadline text-label-secondary">{session.email}</p>
            </header>
            <div className="flex flex-col gap-7">
              {created ? (
                <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
                  {t("created")}
                </CalloutCard>
              ) : null}
              {joinedOrg ? (
                <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
                  {t("joined", { name: joinedOrg.name })}
                </CalloutCard>
              ) : null}

              {/* Super admin : la console Wintek reste son premier accès, avant ses établissements. */}
              {session.isPlatformAdmin ? (
                <ListSection>
                  <ListRow
                    href="/admin"
                    icon={
                      <ListIcon color="var(--brand-tile)">
                        <ShieldCheck />
                      </ListIcon>
                    }
                    title={ta("nav.platform")}
                    accessory="chevron"
                  />
                </ListSection>
              ) : null}

              <section aria-labelledby="orgs-title" className="flex flex-col gap-1.5">
                <h2 id="orgs-title" className="px-4 text-footnote text-label-secondary uppercase">
                  {t("sectionOrgs")}
                </h2>
                <ul role="list" aria-label={t("title")} className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
                  {orgs.map(({ org, role }, i) => (
                    <li key={org.id} className="group/row">
                      <Link
                        href={`/app/o/${org.id}`}
                        className="flex w-full items-center gap-3 pl-4 transition-colors hover:bg-fill-tertiary/50 focus-visible:shadow-[inset_0_0_0_3px_var(--accent-tint)] focus-visible:outline-none active:bg-fill-tertiary"
                      >
                        <span
                          aria-hidden
                          className={`squircle flex shrink-0 items-center justify-center rounded-[8px] font-semibold text-white ${i === 0 ? "size-10 text-subheadline" : "size-9 text-footnote"}`}
                          style={{ background: sectorColor(org.type) }}
                        >
                          {initialsOf(org.name)}
                        </span>
                        <span className={`relative flex min-w-0 flex-1 items-center gap-3 pr-4 list-separator ${i === 0 ? "min-h-16 py-3" : "min-h-14 py-2.5"}`}>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className={`truncate font-semibold ${i === 0 ? "text-headline" : "text-body"}`}>{org.name}</span>
                            <span className="truncate text-footnote text-label-secondary">
                              {subtitle(org, role)}
                              <span className="hidden lg:inline"> · {ta("sidebar.branches", { count: branchCount.get(org.id) ?? 0 })}</span>
                            </span>
                          </span>
                          <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
                        </span>
                      </Link>
                    </li>
                  ))}
                  {session.isPlatformAdmin ? null : (
                    <li className="group/row">
                      <Link
                        href="/app/new"
                        className="flex w-full items-center gap-3 pl-4 text-accent-text transition-colors hover:bg-fill-tertiary/50 focus-visible:shadow-[inset_0_0_0_3px_var(--accent-tint)] focus-visible:outline-none active:bg-fill-tertiary"
                      >
                        <span aria-hidden className="squircle flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint">
                          <Plus className="size-5 stroke-2" />
                        </span>
                        <span className="flex min-h-12 flex-1 items-center py-2.5 pr-4 text-body">{t("create")}</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </section>

              <ListSection header={t("quickAccess")} footer={<span className="hidden lg:inline">{t("footer")}</span>}>
                <ListRow
                  href="/desk"
                  icon={
                    <ListIcon color="var(--accent-fill)">
                      <DoorOpen />
                    </ListIcon>
                  }
                  title={td("open")}
                  subtitle={td("openHint")}
                  accessory="chevron"
                />
                {/* Espace annonceur (M10b) : ouvert à tout compte. */}
                <ListRow
                  href="/ads"
                  icon={
                    <ListIcon color="var(--orange-fill)">
                      <Megaphone />
                    </ListIcon>
                  }
                  title={ta("nav.advertiser")}
                  subtitle={tads("onboardingTitle")}
                  accessory="chevron"
                />
              </ListSection>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
