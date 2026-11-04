import { getLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { LEGAL_DOCUMENTS, isLegalDraft, type LegalDocKey } from "@/lib/legal/documents";

export async function legalTitle(key: LegalDocKey): Promise<string> {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return LEGAL_DOCUMENTS[key][locale].title;
}

/**
 * Page d'un texte légal : articles numérotés (sommaire + sections ancrées `#article-n`).
 * Tant que Wintek n'a pas fourni le texte, « Bientôt disponible » en tête et « Contenu à venir » sous chaque article.
 */
export async function LegalPage({ docKey }: { docKey: LegalDocKey }) {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const t = await getTranslations("auth");
  const doc = LEGAL_DOCUMENTS[docKey][locale];
  const draft = isLegalDraft(doc);
  const updated = doc.updatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Africa/Douala" }).format(new Date(`${doc.updatedAt}T12:00:00Z`))
    : null;
  return (
    <div className="min-h-dvh bg-grouped">
      <NavigationBar title={doc.title} back={{ href: "/login", label: t("backToLogin"), prefetch: false }} contentClassName="max-w-3xl" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),2.5rem)] sm:px-8">
        {draft ? (
          <section
            aria-labelledby="legal-status"
            className="squircle flex items-start gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card"
          >
            <span className="squircle flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent-tint text-accent-on-tint">
              <FileText aria-hidden className="size-6 stroke-[1.75]" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 id="legal-status" className="text-title3 font-bold">
                {t("comingSoon")}
              </h2>
              <p className="text-subheadline text-label-secondary">{t("comingSoonBody")}</p>
            </div>
          </section>
        ) : updated ? (
          <p className="text-footnote text-label-secondary">{t("legalUpdated", { date: updated })}</p>
        ) : null}

        <nav aria-labelledby="legal-toc" className="squircle rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
          <h2 id="legal-toc" className="text-headline font-semibold">
            {t("legalContents")}
          </h2>
          <ol className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {doc.sections.map((s, i) => (
              <li key={s.title}>
                <a href={`#article-${i + 1}`} className="pressable flex min-h-11 items-center gap-3 text-subheadline text-accent-text">
                  <span className="w-6 shrink-0 text-label-secondary tabular">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="squircle flex flex-col rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-2 shadow-card sm:px-8">
          {doc.sections.map((s, i) => (
            <section key={s.title} id={`article-${i + 1}`} aria-labelledby={`article-${i + 1}-title`} className="scroll-mt-20 py-5 hairline-b last:shadow-none">
              <h2 id={`article-${i + 1}-title`} className="text-title3 font-bold">
                <span className="tabular">{i + 1}.</span> {s.title}
              </h2>
              {s.paragraphs.length > 0 ? (
                <div className="mt-2 flex flex-col gap-3 text-body">
                  {s.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-subheadline text-label-secondary">{t("legalPending")}</p>
              )}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
