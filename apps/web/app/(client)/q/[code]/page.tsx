import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { QrCode } from "lucide-react";
import { ServiceChooser } from "@/components/client/service-chooser";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";
import type { EntryInfo } from "@/lib/client/types";
import { captchaConfig } from "@/lib/security/captcha";

type Params = { params: Promise<{ code: string }> };

const CODE = /^[A-Za-z0-9]{6,22}$/;

async function resolve(code: string): Promise<EntryInfo | null> {
  if (!CODE.test(code)) return null;
  const { data } = await callRpc<EntryInfo | null>("resolve_entry", { p_code: code });
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entry = await resolve((await params).code);
  const t = await getTranslations("client.service");
  return { title: entry ? `${entry.organization.name} · ${t("title")}` : t("notFoundTitle"), robots: { index: false } };
}

/**
 * Écran 02 : arrivée par le QR code de l'agence (/q/<jeton>) ou par le code court (/q/<CODE>). Le QR code de
 * l'écran TV ajoute `?p=<code de présence>` (change chaque minute) : il confirme la présence d'un ticket à distance.
 */
export default async function EntryPage({ params, searchParams }: Params & { searchParams: Promise<{ p?: string }> }) {
  const { code } = await params;
  const { p } = await searchParams;
  const presenceCode = typeof p === "string" && /^[A-Za-z0-9]{6}$/.test(p) ? p.toUpperCase() : null;
  const entry = await resolve(code);
  const t = await getTranslations("client.service");

  if (!entry) {
    return (
      <main className="min-h-dvh pb-40">
        <NavigationBar title={t("notFoundTitle")} back={{ href: "/", label: t("back") }} contentClassName="max-w-lg" />
        <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
          <CalloutCard icon={<QrCode />} tone="red" role="alert">
            {t("notFoundBody")}
          </CalloutCard>
          <Button asChild block variant="tinted">
            <Link href="/">{t("rescan")}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return <ServiceChooser entry={entry} presenceCode={presenceCode} captchaSiteKey={captchaConfig().siteKey} />;
}
