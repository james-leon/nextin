"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

const linkClass = "inline-flex min-h-11 items-center px-2 text-label-secondary underline-offset-2 hover:underline";

/**
 * Pied des écrans de connexion et d'inscription (maquette v2 04) : une ligne discrète « Connexion sécurisée ·
 * Conditions · Confidentialité », puis l'acceptation des conditions et la conformité à la loi camerounaise.
 */
export function LegalFooter() {
  const t = useTranslations("auth");
  return (
    <footer className="flex flex-col items-center gap-1 text-center text-footnote text-label-secondary">
      <nav aria-label={t("legalLinks")} className="flex flex-wrap items-center justify-center">
        <span className="inline-flex min-h-11 items-center gap-1.5 px-2">
          <ShieldCheck aria-hidden className="size-4 shrink-0 stroke-[2] text-green-text" />
          {t("secureNotice")}
        </span>
        <Link href="/cgu" prefetch={false} className={linkClass}>
          {t("termsShort")}
        </Link>
        <Link href="/confidentialite" prefetch={false} className={linkClass}>
          {t("privacyShort")}
        </Link>
      </nav>
      <p className="text-caption">
        {t("legalConsent")} {t("lawCompliance")}
      </p>
    </footer>
  );
}
