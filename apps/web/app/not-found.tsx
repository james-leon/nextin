import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Page introuvable (maquette v2 21) : « 404 » discret en gris, l'explication en clair, puis la solution la plus
 * probable en action principale (scanner à nouveau le QR code de l'accueil) et le retour à l'accueil.
 */
export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center">
      <section className="flex flex-1 flex-col items-center justify-center gap-3">
        <p aria-hidden className="font-rounded text-hero font-bold text-label-secondary tabular">404</p>
        <h1 className="text-title1 font-bold [text-wrap:balance]">{t("notFoundTitle")}</h1>
        <p className="text-body text-label-secondary">{t("notFoundBody")}</p>
      </section>
      <div className="flex flex-col gap-2">
        <Link
          href="/scan"
          prefetch={false}
          className="pressable squircle inline-flex h-[3.125rem] w-full items-center justify-center rounded-[12px] bg-primary px-5 text-headline font-semibold text-on-accent"
        >
          {t("scanQr")}
        </Link>
        <Link
          href="/"
          prefetch={false}
          className="pressable squircle inline-flex h-[3.125rem] w-full items-center justify-center rounded-[12px] bg-accent-tint px-5 text-headline font-semibold text-accent-on-tint"
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
