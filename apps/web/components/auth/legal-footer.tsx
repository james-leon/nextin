"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

const linkClass = "inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-semibold text-accent-text";

/** Mention de sécurité et pied de page légal des écrans de connexion et d'inscription. */
export function SecureNotice() {
  const t = useTranslations("auth");
  return (
    <p className="flex items-center justify-center gap-1.5 text-footnote text-label-secondary">
      <ShieldCheck aria-hidden className="size-4 shrink-0 stroke-[2] text-green" />
      {t("secureNotice")}
    </p>
  );
}

export function LegalFooter() {
  const t = useTranslations("auth");
  return (
    <footer className="flex flex-col items-center gap-0.5 text-center text-footnote text-label-secondary">
      <p>{t("legalConsent")}</p>
      <nav aria-label={t("legalLinks")} className="flex flex-wrap items-center justify-center">
        <Link href="/legal/terms" prefetch={false} className={linkClass}>
          {t("terms")}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/legal/privacy" prefetch={false} className={linkClass}>
          {t("privacy")}
        </Link>
      </nav>
      <p>{t("lawCompliance")}</p>
    </footer>
  );
}
