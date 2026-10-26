import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Keyboard } from "lucide-react";
import { ClientTabBar } from "@/components/client/client-tab-bar";
import { QrScanner } from "@/components/client/qr-scanner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.scanner");
  return { title: { absolute: `NextIn · ${t("title")}` } };
}

/** Écran 01 : scanner (toujours sombre). Le plus souvent, le client arrive directement par l'appareil photo sur /q/<jeton>. */
export default async function ScannerPage() {
  const t = await getTranslations("client.scanner");
  return (
    <div data-theme="dark" className="flex min-h-dvh flex-col bg-scanner text-white">
      <main className="flex flex-1 flex-col items-center px-6 pt-[max(env(safe-area-inset-top),3.5rem)] pb-32 text-center">
        <p className="text-footnote font-semibold tracking-[0.12em] text-white/70 uppercase">{t("eyebrow")}</p>
        <h1 className="mt-1 text-large-title leading-tight font-bold">{t("title")}</h1>
        <p className="mt-2 max-w-sm text-subheadline text-white/75">{t("body")}</p>
        <div className="mt-10 flex w-full flex-1 flex-col items-center justify-center">
          <QrScanner />
        </div>
        <div className="mt-6 flex w-full max-w-lg flex-col gap-2">
          <Link
            href="/c"
            className="pressable squircle flex min-h-[3.25rem] items-center gap-3 rounded-[var(--radius-lg)] bg-scanner-control px-4 text-left text-body text-white"
          >
            <Keyboard aria-hidden className="size-5 stroke-[1.75]" />
            {t("code")}
          </Link>
        </div>
      </main>
      <ClientTabBar active="scan" className="bg-scanner-surface/90" />
    </div>
  );
}
