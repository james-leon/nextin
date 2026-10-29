"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { PLAN_FEATURES, type BillingPeriod, type SubscriptionStatus } from "@nextin/shared/billing";
import { checkout } from "@/app/(staff)/app/o/[orgId]/_actions/billing";
import { FormError } from "@/components/auth/form-error";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlanOffer } from "@/lib/billing/types";
import { cn } from "@/lib/cn";

type Props = {
  orgId: string;
  plans: PlanOffer[];
  currentPlanId: string | null;
  status: SubscriptionStatus | null;
  /** Période payée en cours (descente de formule programmée plutôt que facturée). */
  paidPeriodRunning: boolean;
  initialPeriod: BillingPeriod;
  branches: number;
};

/** Choix de la formule et de la période ; une seule action principale (payer, monter ou programmer). */
export function PlanPicker({ orgId, plans, currentPlanId, status, paidPeriodRunning, initialPeriod, branches }: Props) {
  const t = useTranslations("billing");
  const te = useTranslations("errors");
  const locale = useLocale() as "fr" | "en";
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod);
  const firstFit = plans.find((p) => p.id === currentPlanId && p.fits) ?? plans.find((p) => p.code === "pro" && p.fits) ?? plans.find((p) => p.fits);
  const [selectedId, setSelectedId] = useState<string | null>(firstFit?.id ?? null);
  // Téléphone : une formule affichée à la fois, choisie dans le sélecteur du haut (pas de défilement interminable).
  const [viewId, setViewId] = useState<string | null>(firstFit?.id ?? plans[0]?.id ?? null);
  const [state, action, pending] = useActionState(checkout.bind(null, orgId), null);

  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const current = plans.find((p) => p.id === currentPlanId) ?? null;
  const quote = selected ? selected[period] : null;
  const name = (p: PlanOffer) => (locale === "en" ? (p.name_en ?? p.name) : p.name);
  const description = (p: PlanOffer) => (locale === "en" ? (p.description_en ?? p.description) : p.description);
  const xaf = (n: number) => formatXaf(n, locale);

  let label = t("choose");
  if (selected && quote) {
    const amount = xaf(quote.total);
    const isDowngrade = !!current && status === "active" && paidPeriodRunning && selected.base_price_xaf < current.base_price_xaf;
    const isUpgrade = !!current && status === "active" && paidPeriodRunning && selected.base_price_xaf > current.base_price_xaf;
    label = isDowngrade ? t("schedule", { plan: name(selected) }) : isUpgrade ? t("upgrade", { plan: name(selected), amount }) : t("pay", { amount });
  }

  return (
    <section aria-labelledby="plans-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4">
        <h2 id="plans-title" className="text-title3 font-bold">
          {t("plansTitle")}
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SegmentedControl
            label={t("periodLabel")}
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: "monthly", label: t("monthly") },
              { value: "annual", label: t("annual") },
            ]}
            className="w-56 max-w-full"
          />
          <Badge tone="green">{t("annualSaving")}</Badge>
        </div>
      </div>

      {plans.length > 1 ? (
        <SegmentedControl
          label={t("plansTitle")}
          value={viewId ?? ""}
          onValueChange={(id) => {
            setViewId(id);
            if (plans.find((p) => p.id === id)?.fits) setSelectedId(id);
          }}
          options={plans.map((p) => ({ value: p.id, label: name(p) }))}
          className="md:hidden"
        />
      ) : null}

      <div role="radiogroup" aria-labelledby="plans-title" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const q = p[period];
          const isSelected = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!p.fits}
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "pressable squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 text-left shadow-card transition-shadow",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]",
                isSelected && "shadow-[0_0_0_2px_var(--accent-fill)]",
                !p.fits && "opacity-60",
                plans.length > 1 && p.id !== viewId && "hidden md:flex",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-headline">{name(p)}</span>
                {p.id === currentPlanId ? <Badge tone="accent">{t("current")}</Badge> : null}
              </span>
              {description(p) ? <span className="text-subheadline text-label-secondary">{description(p)}</span> : null}
              <span className="flex flex-col">
                <span className="flex items-baseline gap-2">
                  <span className="tabular text-title1 font-bold">{xaf(q.total)}</span>
                  {q.discount > 0 ? <s className="tabular text-subheadline text-label-secondary">{xaf(q.subtotal)}</s> : null}
                </span>
                <span className="text-footnote text-label-secondary">
                  {period === "annual" ? t("perYear") : t("perMonth")} · {t("priceFor", { count: branches })}
                </span>
                {period === "annual" && p.annual_free_months > 0 ? (
                  <span className="text-footnote text-green-text">{t("annualSavingValue", { amount: xaf(q.monthly * p.annual_free_months) })}</span>
                ) : null}
              </span>
              <ul className="flex flex-col gap-1.5 text-subheadline">
                {[
                  t("includedBranches", { count: p.included_branches }),
                  p.extra_branch_price_xaf != null ? t("extraBranch", { price: xaf(p.extra_branch_price_xaf) }) : t("noExtraBranch"),
                  p.max_counters_per_branch != null ? t("countersLimit", { count: p.max_counters_per_branch }) : t("countersUnlimited"),
                  p.max_displays_per_branch != null ? t("displaysLimit", { count: p.max_displays_per_branch }) : t("displaysUnlimited"),
                  t("whatsappQuota", { count: p.whatsapp_quota_per_branch.toLocaleString(locale === "fr" ? "fr-FR" : "en-US") }),
                  ...PLAN_FEATURES.filter((f) => p.features[f]).map((f) => t(`features.${f}`)),
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[2.5] text-accent-text" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {!p.fits ? <span className="text-footnote text-orange-text">{t("doesNotFit")}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="px-4 text-footnote text-label-secondary">
        {t("vatNote")} {status === "active" && paidPeriodRunning ? t("upgradeNote") : null}
      </p>

      {/* `contents` : la barre colle au bas de la section (le formulaire ne crée pas de boîte). */}
      <form action={action} className="contents">
        <input type="hidden" name="planId" value={selectedId ?? ""} />
        <input type="hidden" name="period" value={period} />
        <BottomBar>
          <FormError message={state && !state.ok ? te(state.error) : null} />
          <Button type="submit" block disabled={!selected} loading={pending} loadingLabel={t("paying")}>
            {label}
          </Button>
        </BottomBar>
      </form>
    </section>
  );
}
