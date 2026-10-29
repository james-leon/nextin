import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CodeForm } from "@/components/client/code-form";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { LiteMessages } from "@/lib/i18n/lite-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.code");
  return { title: t("title") };
}

/** Saisie du code de l'établissement (lien « Saisir le code » de l'écran 01). */
export default async function CodePage() {
  const t = await getTranslations("client");
  return (
    <main className="min-h-dvh pb-40">
      <NavigationBar title={t("code.title")} back={{ href: "/", label: t("service.back") }} contentClassName="max-w-lg" />
      <div className="mx-auto max-w-lg px-4 pt-4">
        <LiteMessages paths={["client.code"]}>
          <CodeForm />
        </LiteMessages>
      </div>
    </main>
  );
}
