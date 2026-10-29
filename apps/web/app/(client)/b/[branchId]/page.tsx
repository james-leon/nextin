import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { BranchView } from "@/components/client/branch-view";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";
import type { BranchPublic } from "@/lib/client/types";
import { captchaConfig } from "@/lib/security/captcha";
import { LiteMessages } from "@/lib/i18n/lite-server";

type Params = { params: Promise<{ branchId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string): Promise<BranchPublic | null> {
  if (!UUID.test(id)) return null;
  const { data } = await callRpc<BranchPublic | null>("branch_public", { p_branch: id });
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const branch = await load((await params).branchId);
  const t = await getTranslations("client.branch");
  return { title: branch ? `${branch.organization.name} · ${branch.name}` : t("notFoundTitle") };
}

/** Page publique d'une agence (M9) : files en direct, ticket à distance, demande de rendez-vous. */
export default async function BranchPage({ params }: Params) {
  const branch = await load((await params).branchId);
  if (branch)
    return (
      <LiteMessages paths={["client.branch", "client.service", "errors", "orgTypes", "weekdays"]}>
        <BranchView branch={branch} captchaSiteKey={captchaConfig().siteKey} />
      </LiteMessages>
    );
  const t = await getTranslations("client.branch");
  return (
    <main className="min-h-dvh pb-40">
      <NavigationBar title={t("notFoundTitle")} back={{ href: "/nearby", label: t("back") }} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
        <CalloutCard icon={<Building2 />} tone="red" role="alert">
          {t("notFoundBody")}
        </CalloutCard>
        <Button asChild block variant="tinted">
          <Link href="/nearby">{t("back")}</Link>
        </Button>
      </div>
    </main>
  );
}
