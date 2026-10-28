import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Clock } from "lucide-react";
import type { BillingBanner as Banner } from "@nextin/shared/billing";
import { cn } from "@/lib/cn";

/**
 * Bandeau d'abonnement du back-office (essai qui se termine, paiement en attente, lecture seule) : discret, en haut du
 * contenu, avec « Payer » pour les administrateurs. Rien quand tout va bien.
 */
export async function BillingBanner({ banner, orgId, canPay }: { banner: Banner; orgId: string; canPay: boolean }) {
  if (!banner || banner.kind === "suspended") return null;
  const t = await getTranslations("banner");
  const text = banner.kind === "trial" ? t("trial", { days: banner.daysLeft }) : banner.kind === "past_due" ? t("past_due", { days: banner.daysLeft }) : t("read_only");
  const urgent = banner.kind !== "trial";
  return (
    <div role="status" className="flex min-h-11 items-center gap-3 bg-grouped-secondary px-4 py-2 text-subheadline text-label shadow-[inset_0_-0.5px_0_var(--separator)] lg:px-8">
      <span
        aria-hidden
        className={cn(
          "squircle flex size-7 shrink-0 items-center justify-center rounded-[7px] [&_svg]:size-4 [&_svg]:stroke-2",
          urgent ? "bg-orange-tint text-orange-text" : "bg-accent-tint text-accent-on-tint",
        )}
      >
        {urgent ? <AlertTriangle /> : <Clock />}
      </span>
      <p className="min-w-0 flex-1">
        {text} {canPay ? null : <span className="text-label-secondary">{t("actionStaff")}</span>}
      </p>
      {canPay ? (
        <Link href={`/app/o/${orgId}/billing`} className="pressable inline-flex min-h-11 shrink-0 items-center font-semibold text-accent-text">
          {t("action")}
        </Link>
      ) : null}
    </div>
  );
}
