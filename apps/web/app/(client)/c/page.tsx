import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientTabs } from "@/components/client/client-tabs";
import { CodeForm } from "@/components/client/code-form";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { LiteMessages } from "@/lib/i18n/lite-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.code");
  return { title: t("title") };
}

/** Saisie du code de l'établissement (maquette v2 02), si la caméra ne marche pas. */
export default async function CodePage() {
  const t = await getTranslations("client.code");
  return (
    <main className="min-h-dvh pb-12">
      <NavigationBar title={t("title")} back={{ href: "/scan", label: t("back"), prefetch: false }} contentClassName="max-w-lg lg:max-w-[40rem]">
        <p className="mt-1 text-subheadline text-label-secondary">{t("body")}</p>
      </NavigationBar>
      <div className="mx-auto max-w-lg px-4 pt-4 lg:max-w-[40rem]">
        <LiteMessages paths={["client.code"]}>
          <CodeForm />
        </LiteMessages>
      </div>
      <ClientTabs active="home" mobile={false} />
    </main>
  );
}
