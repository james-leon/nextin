import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/auth/locale-switch";
import { Logo } from "@/components/ui/logo";

/** Année courante à Douala (copyright du panneau de marque). */
function currentYear(): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Africa/Douala", year: "numeric" }).format(new Date());
}

/**
 * Écrans d'authentification (maquette v2 04), partagés par la connexion, l'inscription, l'invitation, la double
 * authentification et « Nouveau mot de passe ».
 * Ordinateur : panneau de marque bleu nuit uni à gauche (sur-titre orange, grand titre, trois avantages, copyright),
 * formulaire sur fond `bg-grouped` à droite. Téléphone et tablette : formulaire seul. Bascule FR / EN en haut à droite.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  const t = await getTranslations("auth");
  const benefits = [t("benefitQr"), t("benefitWhatsapp"), t("benefitTv")];
  return (
    <NextIntlClientProvider messages={{ common: m.common, auth: m.auth, errors: m.errors, mfa: m.mfa }}>
      <div className="min-h-dvh bg-grouped lg:grid lg:grid-cols-[var(--lg-cols)]" style={{ "--lg-cols": "minmax(0,9fr) minmax(0,11fr)" } as React.CSSProperties}>
        {/* Panneau de marque : bleu nuit uni dans les deux apparences (couleur de marque, texte blanc). */}
        <aside
          aria-label={t("panelLabel")}
          className="hidden bg-navy text-white lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:gap-12 lg:px-12 lg:py-10 xl:px-16 xl:py-12"
        >
          <Logo tone="inverse" className="h-10 self-start" />
          <div className="flex max-w-md flex-col">
            <p className="text-subheadline font-semibold text-orange">{t("panelEyebrow")}</p>
            <h2 className="mt-3 text-[2.25rem] leading-[1.1] font-bold tracking-tight text-balance xl:text-[2.625rem]">{t("panelTitle")}</h2>
            <ul className="mt-8 flex flex-col gap-3 text-body text-white/85">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-baseline gap-3">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-white" style={{ transform: "translateY(-0.15em)" }} />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-footnote text-white/75">{t("copyright", { year: currentYear() })}</p>
        </aside>
        <main className="flex min-h-dvh flex-col px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:px-8 lg:px-12">
          <div className="flex justify-end">
            <LocaleSwitch />
          </div>
          <div className="flex flex-1 items-start justify-center pt-4 sm:items-center sm:pt-0">
            <div className="w-full max-w-[22.5rem] py-6 sm:max-w-sm">{children}</div>
          </div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
