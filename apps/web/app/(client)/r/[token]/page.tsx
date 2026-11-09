import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarX } from "lucide-react";
import { RequestStatusView } from "@/components/client/request-status";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";
import type { RequestView } from "@/lib/client/types";
import { captchaConfig } from "@/lib/security/captcha";
import { LiteMessages } from "@/lib/i18n/lite-server";

type Params = { params: Promise<{ token: string }> };
const TOKEN = /^[A-Za-z0-9]{22}$/;

/** Valeur `NEXT_PUBLIC_*` lue à l'exécution (accès calculé : jamais figée au build). */
function runtimeEnv(name: string): string | undefined {
  return process.env[name];
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.requestStatus");
  // Lien personnel : jamais indexé, jamais transmis comme référent.
  return { title: t("title"), robots: { index: false }, referrer: "no-referrer" };
}

/** Suivi d'une demande de rendez-vous (M9) : code de vérification (e-mail, WhatsApp ou SMS), puis réponse de l'accueil. */
export default async function RequestStatusPage({ params }: Params) {
  const { token } = await params;
  const { data } = TOKEN.test(token) ? await callRpc<RequestView | null>("get_appointment_request", { p_token: token }) : { data: null };
  if (data)
    return (
      <LiteMessages paths={["client.request", "client.requestStatus", "errors"]}>
        <RequestStatusView
          token={token}
          initial={data}
          captchaSiteKey={captchaConfig().siteKey}
          vapidKey={runtimeEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || null}
        />
      </LiteMessages>
    );
  const t = await getTranslations("client.requestStatus");
  return (
    <main className="min-h-dvh pb-40">
      <NavigationBar variant="inline" title={t("title")} back={{ href: "/nearby", label: t("back") }} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
        <CalloutCard icon={<CalendarX />} tone="red" role="alert">
          <strong className="font-semibold">{t("notFoundTitle")}.</strong> {t("notFoundBody")}
        </CalloutCard>
        <Button asChild block variant="tinted">
          <Link href="/nearby">{t("back")}</Link>
        </Button>
      </div>
    </main>
  );
}
