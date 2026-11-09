import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, CircleSlash } from "lucide-react";
import { quotaState, type QuotaState } from "@nextin/shared/billing";
import type { QuotaStatus } from "@/lib/billing/types";
import { cn } from "@/lib/cn";

const SEVERITY: Record<QuotaState, number> = { ok: 0, warning: 1, reached: 2, blocked: 3 };

/**
 * Alerte de quota du mois (tickets, puis WhatsApp) en haut du back-office : 80 %, limite atteinte (la file continue
 * jusqu'à ce soir), bloqué depuis le lendemain. Administrateurs : « Changer de formule » et « Acheter une extension ».
 */
export async function QuotaBanner({ quota, alertPercent, orgId, canManage }: { quota: QuotaStatus | null; alertPercent: number; orgId: string; canManage: boolean }) {
  if (!quota) return null;
  const tickets = quotaState(quota.tickets, alertPercent);
  const whatsapp = quotaState(quota.whatsapp, alertPercent);
  const worst = SEVERITY[tickets] >= SEVERITY[whatsapp] ? ("tickets" as const) : ("whatsapp" as const);
  const state = worst === "tickets" ? tickets : whatsapp;
  if (state === "ok") return null;
  const t = await getTranslations("banner");
  const item = quota[worst];
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const key =
    worst === "tickets"
      ? ({ warning: "quotaTicketsWarning", reached: "quotaTicketsReached", blocked: "quotaTicketsBlocked" } as const)[state]
      : ({ warning: "quotaWhatsappWarning", reached: "quotaWhatsappReached", blocked: "quotaWhatsappBlocked" } as const)[state];
  const urgent = state !== "warning";
  return (
    <div
      role="status"
      data-quota={`${worst}-${state}`}
      className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 bg-grouped-secondary px-4 py-2 text-subheadline text-label shadow-[inset_0_-0.5px_0_var(--separator)] lg:px-8"
    >
      <span
        aria-hidden
        className={cn(
          "squircle flex size-7 shrink-0 items-center justify-center rounded-[7px] [&_svg]:size-4 [&_svg]:stroke-2",
          urgent ? "bg-orange-tint text-orange-text" : "bg-accent-tint text-accent-on-tint",
        )}
      >
        {state === "blocked" ? <CircleSlash /> : <AlertTriangle />}
      </span>
      <p className="min-w-0 flex-1">
        {t(key, { used: fmt(item.used), limit: fmt(item.limit ?? 0) })}{" "}
        {canManage ? null : <span className="text-label-secondary">{t("actionStaff")}</span>}
      </p>
      {canManage ? (
        <span className="flex shrink-0 flex-wrap items-center gap-x-4">
          <Link href={`/app/o/${orgId}/billing#plans-title`} className="pressable inline-flex min-h-11 items-center font-semibold text-accent-text">
            {t("changePlan")}
          </Link>
          <Link href={`/app/o/${orgId}/billing#extensions`} className="pressable inline-flex min-h-11 items-center font-semibold text-accent-text">
            {t("buyExtension")}
          </Link>
        </span>
      ) : null}
    </div>
  );
}
