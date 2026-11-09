import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CircleSlash, MessageCircle, Ticket } from "lucide-react";
import { quotaState, type QuotaItem, type QuotaState } from "@nextin/shared/billing";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDay } from "@/lib/billing/format";
import type { QuotaStatus } from "@/lib/billing/types";
import { cn } from "@/lib/cn";

/**
 * Consommation du mois (tickets, messages WhatsApp) : jauge, extensions comprises, et ce qui se passe à la limite
 * (la file continue jusqu'à la fermeture du jour, blocage seulement à partir du lendemain).
 */
export async function QuotaPanel({ quota, alertPercent }: { quota: QuotaStatus; alertPercent: number }) {
  const t = await getTranslations("billing");
  const current = await getLocale();
  const locale = current === "en" ? "en" : "fr";
  const num = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(n);
  const rows: { key: "tickets" | "whatsapp"; label: string; icon: React.ReactNode; item: QuotaItem }[] = [
    { key: "tickets", label: t("quotaTickets"), icon: <Ticket />, item: quota.tickets },
    { key: "whatsapp", label: t("quotaWhatsapp"), icon: <MessageCircle />, item: quota.whatsapp },
  ];
  const message = (key: "tickets" | "whatsapp", state: QuotaState, item: QuotaItem) => {
    if (state === "warning") return t("quotaWarning", { percent: item.percent ?? 0 });
    if (state === "reached") return key === "tickets" ? t("quotaReachedTickets") : t("quotaReachedWhatsapp");
    if (state === "blocked") {
      const date = formatDay(item.reached_on ?? quota.month, locale);
      return key === "tickets" ? t("quotaBlockedTickets", { date }) : t("quotaBlockedWhatsapp", { date });
    }
    return null;
  };
  return (
    <section id="quota" aria-labelledby="quota-title" className="squircle flex scroll-mt-20 flex-col gap-5 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <h2 id="quota-title" className="text-headline">
        {t("quotaTitle")}
      </h2>
      {rows.map(({ key, label, icon, item }) => {
        const state = quotaState(item, alertPercent);
        const text = message(key, state, item);
        return (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-subheadline">
              <span className="flex items-center gap-2 font-semibold [&_svg]:size-4 [&_svg]:stroke-2 [&_svg]:text-label-secondary">
                <span aria-hidden>{icon}</span>
                {label}
              </span>
              <span className="tabular text-label-secondary">
                {item.limit == null ? `${num(item.used)} · ${t("unlimited")}` : t("ofLimit", { used: num(item.used), limit: num(item.limit) })}
              </span>
            </div>
            {item.limit != null ? (
              <ProgressBar value={Math.min(1, item.limit > 0 ? item.used / item.limit : 1)} label={label} tone={state === "ok" ? "accent" : "orange"} />
            ) : null}
            {item.extra > 0 ? <p className="text-footnote text-label-secondary">{t("quotaExtra", { count: num(item.extra) })}</p> : null}
            {text ? (
              <p className={cn("flex items-start gap-2 text-footnote", state === "warning" ? "text-label-secondary" : "text-orange-text")}>
                {state === "blocked" ? <CircleSlash aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                <span>{text}</span>
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
