import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { NavigationBar } from "@/components/ui/navigation-bar";

const DOCS = { terms: "termsTitle", privacy: "privacyTitle" } as const;
type Doc = keyof typeof DOCS;

function isDoc(doc: string): doc is Doc {
  return doc in DOCS;
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations("auth");
  return { title: t(DOCS[doc]) };
}

/** CGU et politique de confidentialité : contenu à fournir par Wintek, « Bientôt disponible » d'ici là. */
export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const t = await getTranslations("auth");
  return (
    <div className="min-h-dvh bg-grouped">
      <NavigationBar title={t(DOCS[doc])} back={{ href: "/login", label: t("backToLogin"), prefetch: false }} contentClassName="max-w-2xl" />
      <main className="mx-auto w-full max-w-2xl px-4 pb-[max(env(safe-area-inset-bottom),2rem)] sm:px-8">
        <section className="squircle mt-4 flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-12 text-center shadow-card">
          <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint">
            <FileText aria-hidden className="size-8 stroke-[1.75]" />
          </span>
          <h2 className="text-title2 font-bold">{t("comingSoon")}</h2>
          <p className="max-w-md text-body text-label-secondary">{t("comingSoonBody")}</p>
        </section>
      </main>
    </div>
  );
}
