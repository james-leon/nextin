import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/auth/locale-switch";
import { Logo } from "@/components/ui/logo";

/**
 * Écrans d'authentification (style A). Téléphone et tablette : formulaire seul, colonne étroite centrée.
 * Ordinateur : deux panneaux arrondis — formulaire à gauche, panneau bleu à droite avec un aperçu de l'application.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  const t = await getTranslations("auth");
  return (
    <NextIntlClientProvider messages={{ common: m.common, auth: m.auth, errors: m.errors }}>
      <div className="min-h-dvh lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
        <main className="squircle mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] lg:mx-0 lg:min-h-0 lg:max-w-none lg:items-center lg:rounded-[var(--radius-2xl)] lg:bg-grouped-secondary lg:px-12 lg:py-12 lg:shadow-card">
          <div className="flex w-full max-w-md flex-1 flex-col">
            <Logo className="mb-10 self-center lg:self-start" />
            <div className="flex-1">{children}</div>
            <LocaleSwitch className="mt-10" />
          </div>
        </main>
        {/* Aperçu de l'application (décoratif) : jamais sur téléphone. */}
        <aside
          aria-hidden
          className="squircle relative hidden overflow-hidden rounded-[var(--radius-2xl)] bg-accent p-12 text-white lg:flex lg:flex-col lg:justify-between"
        >
          <span className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-white/5" />
          <div className="relative max-w-sm">
            <p className="text-title1 font-bold">{t("panelTitle")}</p>
            <p className="mt-3 text-body text-white">{t("panelBody")}</p>
          </div>
          {/* Aperçu toujours en clair (comme l'écran TV ou le ticket imprimé), couleurs par jetons. */}
          <div data-theme="light" className="relative mx-auto w-full max-w-xs">
            <div className="squircle rounded-[var(--radius-2xl)] bg-grouped-secondary p-6 text-center text-label shadow-floating">
              <div className="flex items-center justify-center gap-2">
                <span className="text-footnote font-semibold tracking-[0.08em] text-label-secondary uppercase">{t("previewService")}</span>
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-green-tint px-2.5 text-footnote font-semibold text-green-text">
                  <span className="size-1.5 rounded-full bg-green" />
                  {t("previewLive")}
                </span>
              </div>
              <p className="mt-2 text-hero font-extrabold text-ticket-number">C-047</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <div className="rounded-[var(--radius-lg)] bg-fill-tertiary px-4 py-3">
                  <p className="text-subheadline text-label-secondary">{t("previewAhead")}</p>
                  <p className="text-title1 font-bold">3</p>
                </div>
                <div className="rounded-[var(--radius-lg)] bg-fill-tertiary px-4 py-3">
                  <p className="text-subheadline text-label-secondary">{t("previewWait")}</p>
                  <p className="text-title1 font-bold whitespace-nowrap">≈ 12 min</p>
                </div>
              </div>
            </div>
          </div>
          <p className="relative text-subheadline font-semibold text-white">{t("panelFooter")}</p>
        </aside>
      </div>
    </NextIntlClientProvider>
  );
}
