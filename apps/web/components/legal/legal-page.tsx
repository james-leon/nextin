import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { FileText, Languages } from "lucide-react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import {
  LEGAL_DOCUMENTS,
  isLegalDraft,
  parseInline,
  parseLegalBody,
  type LegalBlock,
  type LegalDocKey,
  type LegalInline,
} from "@/lib/legal/documents";

export async function legalTitle(key: LegalDocKey): Promise<string> {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return LEGAL_DOCUMENTS[key][locale].title;
}

/** Typographie française : espace fine insécable avant « ? ! : ; » et dans les guillemets (le texte source reste intact). */
function typo(text: string): string {
  return text.replace(/ ([?!:;»])/g, "\u202f$1").replace(/« /g, "«\u202f");
}

/** Texte en ligne : gras et mentions à compléter (entre crochets, surlignées pour rester repérables). */
function Inlines({ parts }: { parts: LegalInline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        let node: ReactNode = typo(part.text);
        if (part.placeholder) {
          node = (
            <mark data-legal-placeholder className="rounded-[4px] bg-orange-tint px-1 font-semibold text-label [box-decoration-break:clone]">
              {typo(part.text)}
            </mark>
          );
        }
        return part.bold ? (
          <strong key={i} className="font-semibold">
            {node}
          </strong>
        ) : (
          <span key={i}>{node}</span>
        );
      })}
    </>
  );
}

function Block({ block, id }: { block: LegalBlock; id: string }) {
  switch (block.kind) {
    case "h3":
      return <h3 className="mt-2 text-headline font-semibold">{typo(block.text)}</h3>;
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-label-secondary">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines parts={item} />
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <>
          {/* Téléphone : une fiche par ligne (première colonne en titre, les autres avec leur intitulé). */}
          <ul data-legal-table="cards" className="flex flex-col gap-2 sm:hidden">
            {block.rows.map((row, r) => (
              <li key={r} className="squircle rounded-[var(--radius-lg)] bg-fill-tertiary px-4 py-3">
                <p className="text-callout font-semibold">
                  <Inlines parts={row[0] ?? []} />
                </p>
                <dl className="mt-1.5 flex flex-col gap-1.5">
                  {row.slice(1).map((cell, c) => (
                    <div key={c}>
                      <dt className="text-footnote font-semibold text-label-secondary">
                        <Inlines parts={block.head[c + 1] ?? []} />
                      </dt>
                      <dd className="text-subheadline">
                        <Inlines parts={cell} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          {/* Tablette et ordinateur : tableau. */}
          <div data-legal-table="grid" className="hidden sm:block">
            <table className="w-full border-collapse text-left text-subheadline">
              <caption id={`${id}-caption`} className="sr-only">
                {block.head.map((h) => h.map((p) => p.text).join("")).join(", ")}
              </caption>
              <thead>
                <tr className="hairline-b">
                  {block.head.map((cell, i) => (
                    <th key={i} scope="col" className="px-3 py-2 align-bottom text-footnote font-semibold text-label-secondary first:pl-0 last:pr-0">
                      <Inlines parts={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="hairline-b last:shadow-none">
                    {row.map((cell, c) =>
                      c === 0 ? (
                        <th key={c} scope="row" className="px-3 py-2.5 align-top font-medium first:pl-0">
                          <Inlines parts={cell} />
                        </th>
                      ) : (
                        <td key={c} className="px-3 py-2.5 align-top text-label-secondary last:pr-0">
                          <Inlines parts={cell} />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    default:
      return (
        <p>
          <Inlines parts={block.inlines} />
        </p>
      );
  }
}

/**
 * Page d'un texte légal : version en tête, articles numérotés (sommaire + sections ancrées `#article-n`),
 * tableaux et mentions à compléter visibles. En anglais, rappel que la version française fait foi.
 */
export async function LegalPage({ docKey }: { docKey: LegalDocKey }) {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const t = await getTranslations("auth");
  const doc = LEGAL_DOCUMENTS[docKey][locale];
  const draft = isLegalDraft(doc);
  return (
    <div className="min-h-dvh bg-grouped">
      <NavigationBar title={doc.title} back={{ href: "/login", label: t("backToLogin"), prefetch: false }} contentClassName="max-w-3xl" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),2.5rem)] sm:px-8">
        <section aria-label={doc.version} className="squircle flex items-start gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
          <span className="squircle flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent-tint text-accent-on-tint">
            <FileText aria-hidden className="size-6 stroke-[1.75]" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p data-legal-version className="text-headline font-semibold">
              <Inlines parts={parseInline(doc.version)} />
            </p>
            {doc.notice ? <p className="text-subheadline text-label-secondary">{typo(doc.notice)}</p> : null}
            {draft ? <p className="text-subheadline text-label-secondary">{t("comingSoonBody")}</p> : null}
          </div>
        </section>

        {doc.translationNote ? (
          <p className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-fill-tertiary px-4 py-3 text-subheadline text-label-secondary">
            <Languages aria-hidden className="mt-0.5 size-5 shrink-0 stroke-[1.75] text-label-tertiary" />
            {doc.translationNote}
          </p>
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
                  {typo(s.title)}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="squircle flex flex-col rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-2 shadow-card sm:px-8">
          {doc.sections.map((s, i) => {
            const id = `article-${i + 1}`;
            const blocks = parseLegalBody(s.body);
            return (
              <section key={s.title} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-5 hairline-b last:shadow-none">
                <h2 id={`${id}-title`} className="text-title3 font-bold">
                  <span className="tabular">{i + 1}.</span> {typo(s.title)}
                </h2>
                {blocks.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-3 text-body">
                    {blocks.map((b, j) => (
                      <Block key={j} block={b} id={`${id}-b${j}`} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-subheadline text-label-secondary">{t("legalPending")}</p>
                )}
              </section>
            );
          })}
        </article>
      </main>
    </div>
  );
}
