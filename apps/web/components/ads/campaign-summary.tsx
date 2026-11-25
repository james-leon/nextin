"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatXaf } from "@nextin/shared";
import type { CampaignSummary } from "@nextin/shared/ads";
import { cn } from "@/lib/cn";

const day = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/**
 * Récapitulatif d'une campagne (maquette v2 24) : `aside` = colonne de droite pendant les étapes (formule, période,
 * villes, établissements, agences, total) ; `full` = étape « Envoi » et détail d'une campagne pas encore diffusée
 * (formule et durée, période, ciblage, visuels, quiz, total). Le total en gras sous un filet.
 */
export function CampaignSummaryCard({
  variant,
  packageName,
  durationDays,
  summary,
  quizAllowed,
  className,
}: {
  variant: "aside" | "full";
  packageName: string | null;
  durationDays: number | null;
  summary: CampaignSummary;
  quizAllowed?: boolean;
  className?: string;
}) {
  const t = useTranslations("ads.wizard.summary");
  const ta = useTranslations("ads");
  const locale = useLocale();
  const period = summary.period ? ta("period", { from: day(summary.period.from, locale), to: day(summary.period.to, locale) }) : "—";
  const cities = summary.cities.length ? summary.cities.join(", ") : t("allCountry");
  const types = summary.orgTypes ? t("typesCount", { count: summary.orgTypes }) : t("allTypes");
  const branches = summary.maxBranches == null ? ta("wizard.branchesAll") : ta("wizard.branchesMax", { count: summary.maxBranches });
  const visuals =
    [summary.images ? t("images", { count: summary.images }) : null, summary.videos ? t("videos", { count: summary.videos }) : null].filter(Boolean).join(" · ") ||
    t("none");
  const rows: [string, string][] =
    variant === "aside"
      ? [
          [t("package"), packageName ?? "—"],
          [t("period"), period],
          [t("cities"), cities],
          [t("orgTypes"), types],
          [t("branches"), branches],
        ]
      : [
          [t("package"), packageName && durationDays ? t("packageDuration", { name: packageName, count: durationDays }) : "—"],
          [t("period"), period],
          [t("targeting"), summary.orgTypes ? `${cities} · ${types}` : cities],
          [t("creatives"), visuals],
          ...(quizAllowed ? ([[t("quiz"), summary.quizQuestions ? t("questions", { count: summary.quizQuestions }) : t("none")]] as [string, string][]) : []),
        ];
  return (
    <dl data-testid={`campaign-summary-${variant}`} className={cn("squircle flex flex-col gap-2.5 rounded-[var(--radius-lg)] bg-grouped-secondary p-4 text-subheadline", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="shrink-0 text-label-secondary">{label}</dt>
          <dd className="min-w-0 text-right">{value}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3 pt-2.5 hairline-t text-headline">
        <dt>{t("total")}</dt>
        <dd className="font-rounded font-bold tabular">{summary.total == null ? "—" : summary.total ? formatXaf(summary.total, locale === "en" ? "en" : "fr") : ta("free")}</dd>
      </div>
    </dl>
  );
}
