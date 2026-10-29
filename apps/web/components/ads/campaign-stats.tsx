import { getLocale, getTranslations } from "next-intl/server";
import { BarChart } from "@/components/dashboard/bar-chart";
import { StatCard } from "@/components/ui/stat-card";
import type { CampaignStats } from "@/lib/ads/types";

/** Statistiques anonymes d'une campagne : affichages, clics, parties, bons émis et utilisés, affichages par jour. */
export async function CampaignStatsView({ stats }: { stats: CampaignStats }) {
  const t = await getTranslations("ads");
  const locale = await getLocale();
  const n = (v: number) => new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR").format(v);
  const s = stats.totals;
  const impressions = s.impressions + s.interstitial_impressions;
  const days = stats.days.slice(-30);
  const peak = days.reduce((best, d, i) => (d.impressions > (days[best]?.impressions ?? -1) ? i : best), -1);
  const dayLabel = (iso: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  return (
    <section aria-labelledby="stats-title" className="flex flex-col gap-3">
      <h2 id="stats-title" className="px-4 text-title3 font-bold">
        {t("stats")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("kpi.impressions")} value={<span className="tabular">{n(impressions)}</span>} />
        <StatCard label={t("kpi.clicks")} value={<span className="tabular">{n(s.clicks)}</span>} />
        <StatCard label={t("kpi.skips")} value={<span className="tabular">{n(s.skips + s.interstitial_skips)}</span>} />
        <StatCard label={t("kpi.plays")} value={<span className="tabular">{n(s.quiz_plays + s.game_plays)}</span>} />
        <StatCard label={t("kpi.couponsIssued")} value={<span className="tabular">{n(s.coupons_issued)}</span>} />
        <StatCard label={t("kpi.couponsRedeemed")} value={<span className="tabular">{n(s.coupons_redeemed)}</span>} />
      </div>
      {days.length ? (
        <div className="squircle rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
          <h3 className="mb-3 text-headline">{t("perDay")}</h3>
          <BarChart
            bars={days.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.impressions, tooltip: `${dayLabel(d.day)} · ${n(d.impressions)}` }))}
            highlight={peak}
            caption={t("perDay")}
            columns={[t("day"), t("count")]}
          />
        </div>
      ) : (
        <p className="px-4 text-footnote text-label-secondary">{t("statsEmpty")}</p>
      )}
    </section>
  );
}
