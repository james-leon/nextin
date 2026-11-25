import { getLocale, getTranslations } from "next-intl/server";
import { formatXaf } from "@nextin/shared";
import { packageBadges } from "@nextin/shared/ads";
import { medalColor } from "@/lib/ads/format";
import type { PackageRow } from "@/lib/ads/types";

/**
 * Formules publicitaires en lecture seule (maquette v2 24, « Formules ») : mêmes cartes que l'étape 1 de la nouvelle
 * campagne — pastille, nom, description, surfaces, prix et durée. Tout vient de `ad_packages` (console Wintek).
 */
export async function PackageList({ packages }: { packages: PackageRow[] }) {
  const t = await getTranslations("ads");
  const current = await getLocale();
  const locale = current === "en" ? "en" : "fr";
  return (
    <ul role="list" className="squircle flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary [&>*+*]:hairline-t">
      {packages.map((p) => {
        const label = locale === "en" ? p.name_en : p.name;
        return (
          <li key={p.code} data-package={p.code} className="flex items-start gap-3 px-4 py-3">
            <span aria-hidden className="mt-0.5 flex size-[1.875rem] shrink-0 items-center justify-center rounded-full text-caption font-extrabold text-white" style={{ background: medalColor(p.code) }}>
              {label.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-headline">{label}</span>
              {p.description ? <span className="text-footnote text-label-secondary">{locale === "en" ? (p.description_en ?? p.description) : p.description}</span> : null}
              <span className="flex flex-wrap gap-1.5 pt-0.5">
                {packageBadges(p).map((b) => (
                  <span key={b} className="rounded-full bg-fill-tertiary px-2 py-0.5 text-caption font-semibold text-label-secondary">
                    {t(`badges.${b}` as "badges.tv")}
                  </span>
                ))}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end text-right">
              <span className="font-rounded text-headline font-bold tabular">{p.price_xaf ? formatXaf(p.price_xaf, locale) : t("free")}</span>
              <span className="text-caption text-label-secondary">{t("days", { count: p.duration_days })}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
