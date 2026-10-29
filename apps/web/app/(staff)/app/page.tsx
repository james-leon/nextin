import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, CheckCircle2, DoorOpen, Megaphone, Plus, Settings, ShieldCheck } from "lucide-react";
import type { MemberRole } from "@nextin/shared";
import type { Database } from "@nextin/shared/database";
import { OrgTypeIcon } from "@/components/staff/org-type-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Logo } from "@/components/ui/logo";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Org = Pick<Database["public"]["Tables"]["organizations"]["Row"], "id" | "name" | "status" | "type">;

const ROLE_ORDER: MemberRole[] = ["org_admin", "branch_manager", "receptionist", "agent"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staff");
  return { title: t("title") };
}

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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-12">
      <div className="flex h-11 items-center justify-between">
        <Logo />
        <Button asChild variant="plain" size="md">
          <Link href="/app/settings">
            <Settings aria-hidden className="size-5" />
            {ts("open")}
          </Link>
        </Button>
      </div>

      <header className="pt-6 pb-4">
        <h1 className="text-large-title font-bold">{t("title")}</h1>
        <p className="mt-1 truncate text-subheadline text-label-secondary">{session.email}</p>
        {orgs.length > 0 ? <p className="mt-0.5 text-subheadline text-label-secondary">{t("subtitle")}</p> : null}
      </header>

      <div className="flex flex-col gap-6">
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

        {orgs.length === 0 ? (
          <section className="flex flex-col items-center gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-10 text-center">
            <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint">
              <Building2 aria-hidden className="size-8 stroke-[1.5]" />
            </span>
            <h2 className="text-title2 font-bold">{t("emptyTitle")}</h2>
            <p className="text-body text-label-secondary">{t("emptyBody")}</p>
            <Button asChild block className="mt-2">
              <Link href="/app/new">{t("create")}</Link>
            </Button>
          </section>
        ) : (
          <>
            <ListSection>
              {orgs.map(({ org, role }) => (
                <ListRow
                  key={org.id}
                  href={`/app/o/${org.id}`}
                  icon={
                    <ListIcon color="var(--brand-tile)">
                      <OrgTypeIcon type={org.type} />
                    </ListIcon>
                  }
                  title={<span className="font-semibold">{org.name}</span>}
                  subtitle={`${tt(org.type)} · ${tr(role)}`}
                  accessory={
                    org.status === "active" ? "chevron" : (
                      <Badge tone={org.status === "suspended" ? "red" : "orange"}>{t(`status.${org.status}`)}</Badge>
                    )
                  }
                />
              ))}
            </ListSection>
            <ListSection>
              <ListRow
                href="/desk"
                icon={
                  <ListIcon color="var(--accent-fill)">
                    <DoorOpen />
                  </ListIcon>
                }
                title={<span className="font-semibold">{td("open")}</span>}
                subtitle={td("openHint")}
                accessory="chevron"
              />
              {session.isPlatformAdmin ? (
                <ListRow
                  href="/admin"
                  icon={
                    <ListIcon color="var(--brand-tile)">
                      <ShieldCheck />
                    </ListIcon>
                  }
                  title={<span className="font-semibold">{ta("nav.platform")}</span>}
                  accessory="chevron"
                />
              ) : null}
            </ListSection>
            <Button asChild block variant="tinted">
              <Link href="/app/new">
                <Plus aria-hidden className="size-5" />
                {t("create")}
              </Link>
            </Button>
          </>
        )}
        {/* Espace annonceur (M10b) : ouvert à tout compte, même sans établissement. */}
        <ListSection>
          <ListRow
            href="/ads"
            icon={
              <ListIcon color="var(--orange-fill)">
                <Megaphone />
              </ListIcon>
            }
            title={<span className="font-semibold">{ta("nav.advertiser")}</span>}
            subtitle={tads("onboardingTitle")}
            accessory="chevron"
          />
        </ListSection>
      </div>
    </main>
  );
}
