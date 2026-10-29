import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Sparkles } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { SetupOverview, setupSteps } from "@/components/admin/setup-overview";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { finishSetup } from "../_actions/onboarding";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("setupTitle") };
}

/**
 * Démarrage (§11.3) : étapes de configuration, reprenables à tout moment (chacune est mesurée sur les données de
 * l'établissement). Après l'inscription, message de bienvenue avec la durée de l'essai.
 */
export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { welcome } = await searchParams;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("dashboard");
  const to = await getTranslations("overview");
  const tb = await getTranslations("billing");
  const setup = ctx.canManageOrg ? await setupSteps(orgId) : null;
  let trialDays: number | null = null;
  if (welcome) {
    const { data } = await (await getSupabaseServerClient()).from("platform_settings").select("trial_days").maybeSingle();
    trialDays = data?.trial_days ?? null;
  }
  return (
    <AdminPage title={t("setupTitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: to("title") }}>
      {welcome && trialDays !== null ? (
        <CalloutCard tone="accent" role="status" icon={<Sparkles />}>
          <strong className="font-semibold">{tb("welcomeTitle")}.</strong> {tb("welcomeBody", { days: trialDays })}
        </CalloutCard>
      ) : null}
      {setup?.complete && ctx.org.onboarding_step < 5 ? (
        <CalloutCard tone="green" icon={<CheckCircle2 />}>
          <strong className="font-semibold">{to("finishTitle")}.</strong> {to("finishBody")}
        </CalloutCard>
      ) : null}
      {/* Les étapes mènent déjà à chaque rubrique : pas de liste de navigation en double. */}
      <SetupOverview orgId={orgId} />
      {setup?.complete && ctx.org.onboarding_step < 5 ? (
        <form action={finishSetup.bind(null, orgId)}>
          <BottomBar>
            <Button type="submit" block>
              {to("finish")}
            </Button>
          </BottomBar>
        </form>
      ) : null}
    </AdminPage>
  );
}
