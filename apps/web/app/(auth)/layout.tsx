import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { BellRing, ChartNoAxesColumnIncreasing, MessageCircle, type LucideIcon } from "lucide-react";
import { LocaleSwitch } from "@/components/auth/locale-switch";
import { Logo } from "@/components/ui/logo";

/** Année courante à Douala (copyright du panneau de marque). */
function currentYear(): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Africa/Douala", year: "numeric" }).format(new Date());
}

/**
 * Écrans d'authentification (style aligné sur SchoolMaster, autre produit Wintek).
 * Ordinateur : panneau de marque bleu nuit à gauche (dégradé très léger), formulaire sur fond gris clair à droite.
 * Téléphone et tablette : panneau du formulaire seul. Bascule FR / EN en haut à droite.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  const t = await getTranslations("auth");
  const benefits: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: BellRing, title: t("benefitCallTitle"), body: t("benefitCallBody") },
    { icon: MessageCircle, title: t("benefitWhatsappTitle"), body: t("benefitWhatsappBody") },
    { icon: ChartNoAxesColumnIncreasing, title: t("benefitStatsTitle"), body: t("benefitStatsBody") },
  ];
  return (
    <NextIntlClientProvider messages={{ common: m.common, auth: m.auth, errors: m.errors, mfa: m.mfa }}>
      <div className="min-h-dvh bg-grouped lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Panneau de marque : bleu nuit dans les deux apparences (couleur de marque, texte blanc). */}
        <aside
          aria-label={t("panelLabel")}
          className="relative hidden overflow-hidden bg-linear-to-br from-navy to-navy-deep text-white lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:gap-12 lg:px-12 lg:py-12 xl:px-16 xl:py-14"
        >
          {/* Halo décoratif très discret (profondeur, sans détourner du contenu). */}
          <span aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-white/[0.04]" />
          <Logo tone="inverse" className="relative h-12 self-start" />
          <div className="relative flex max-w-lg flex-col">
            <p className="text-footnote font-semibold tracking-[0.14em] text-orange uppercase">{t("panelEyebrow")}</p>
            <h2 className="mt-4 text-[2.75rem] leading-[1.06] font-extrabold tracking-tight whitespace-pre-line xl:text-[3.25rem]">
              {t("panelTitle")}
            </h2>
            <p className="mt-5 text-body text-white/80">{t("panelBody")}</p>
            <ul className="mt-10 flex flex-col gap-5">
              {benefits.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className="squircle flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white/10 ring-1 ring-white/15"
                  >
                    <Icon className="size-5 stroke-[1.75]" />
                  </span>
                  <span className="flex flex-col pt-0.5">
                    <span className="text-headline">{title}</span>
                    <span className="text-subheadline text-white/75">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-footnote text-white/75">{t("copyright", { year: currentYear() })}</p>
        </aside>
        <main className="flex min-h-dvh flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:px-8 lg:px-12">
          <div className="flex justify-end">
            <LocaleSwitch />
          </div>
          <div className="flex flex-1 items-start justify-center pt-6 sm:items-center sm:pt-0">
            <div className="w-full max-w-md py-6">{children}</div>
          </div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
