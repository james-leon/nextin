import { getLocale, getTranslations } from "next-intl/server";
import { BarChart } from "@/components/dashboard/bar-chart";
import { StatCard, StatGroup } from "@/components/ui/stat-card";
import type { CampaignStats } from "@/lib/ads/types";

/**
 * Statistiques anonymes d'une campagne (maquette v2 24) : six chiffres dans une seule carte à filets (affichages,
 * clics, parties jouées, bons émis, bons utilisés, pubs passées), puis les affichages par jour, le pic en orange.
 */
export async function CampaignStatsView({ stats }: { stats: CampaignStats }) {
  const t = await getTranslations("ads");
  const locale = await getLocale();
  const n = (v: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR").format(v);
  const s = stats.totals;
  const impressions = s.impressions + s.interstitial_impressions;
  const days = stats.days.slice(-30);
  const peak = days.reduce((best, d, i) => (d.impressions > (days[best]?.impressions ?? -1) ? i : best), -1);
  const fmt = (iso: string, month: boolean) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", ...(month ? { month: "short" } : {}), timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const kpis = [
    { key: "impressions", value: impressions },
    { key: "clicks", value: s.clicks },
    { key: "plays", value: s.quiz_plays + s.game_plays },
    { key: "couponsIssued", value: s.coupons_issued },
    { key: "couponsRedeemed", value: s.coupons_redeemed },
    { key: "skips", value: s.skips + s.interstitial_skips },
  ] as const;
  return (
    <section aria-labelledby="stats-title" className="flex flex-col gap-3">
      <h2 id="stats-title" className="sr-only">
        {t("stats")}
      </h2>
      <StatGroup className="lg:grid-cols-3 @md:grid-cols-3">
        {kpis.map((k) => (
          <StatCard key={k.key} label={t(`kpi.${k.key}`)} value={<span className="font-rounded tabular">{n(k.value)}</span>} />
        ))}
      </StatGroup>
      <div className="squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4">
        <h3 className="text-footnote tracking-wide text-label-secondary uppercase">{t("perDay")}</h3>
        {days.length ? (
          <BarChart
            bars={days.map((d) => ({ key: d.day, label: fmt(d.day, false), value: d.impressions, tooltip: `${fmt(d.day, true)} · ${n(d.impressions)}` }))}
            highlight={peak}
            caption={t("perDay")}
            columns={[t("day"), t("count")]}
          />
        ) : (
          <p className="text-subheadline text-label-secondary">{t("statsEmpty")}</p>
        )}
      </div>
      <p className="px-4 text-footnote text-label-secondary">{t("statsNote")}</p>
    </section>
  );
}
