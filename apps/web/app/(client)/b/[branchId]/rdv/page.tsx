import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarX } from "lucide-react";
import { RequestForm } from "@/components/client/request-form";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";
import type { RequestOptions } from "@/lib/client/types";
import { captchaConfig } from "@/lib/security/captcha";
import { LiteMessages } from "@/lib/i18n/lite-server";

type Params = { params: Promise<{ branchId: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.request");
  return { title: t("title"), robots: { index: false } };
}

/** Demande de rendez-vous (M9) : créneaux libres calculés à l'ouverture de la page. */
export default async function RequestPage({ params }: Params) {
  const { branchId } = await params;
  const { data } = UUID.test(branchId)
    ? await callRpc<RequestOptions>("request_options", { p_branch: branchId })
    : { data: null };
  if (data)
    return (
      <LiteMessages paths={["client.request", "errors"]}>
        <RequestForm options={data} branchId={branchId} captchaSiteKey={captchaConfig().siteKey} />
      </LiteMessages>
    );
  const t = await getTranslations("client.request");
  return (
    <main className="min-h-dvh pb-40">
      <NavigationBar title={t("disabledTitle")} back={{ href: `/b/${branchId}`, label: t("back") }} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
        <CalloutCard icon={<CalendarX />} role="status">
          {t("disabledBody")}
        </CalloutCard>
        <Button asChild block variant="tinted">
          <Link href={UUID.test(branchId) ? `/b/${branchId}` : "/nearby"}>{t("back")}</Link>
        </Button>
      </div>
    </main>
  );
}
