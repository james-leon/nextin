"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Établissement suspendu (§11.4) : l'accès du personnel se limite à la page Abonnement (paiement = réactivation
 * immédiate). Suspension pour modération : aucune page, message neutre.
 */
export function SuspendedGate({
  orgId,
  reason,
  canPay,
  children,
}: {
  orgId: string;
  reason: "subscription" | "moderation" | null;
  canPay: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("banner");
  const tb = useTranslations("billing");
  const billing = `/app/o/${orgId}/billing`;
  if (!reason || (reason === "subscription" && canPay && pathname.startsWith(billing))) return <>{children}</>;
  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-red-tint text-red-on-tint">
        <ShieldAlert aria-hidden className="size-8 stroke-[1.5]" />
      </span>
      <h1 className="text-title2 font-bold">{t("suspended")}</h1>
      <p className="text-body text-label-secondary">{reason === "subscription" ? (canPay ? tb("readOnlyBody") : t("actionStaff")) : t("actionStaff")}</p>
      {reason === "subscription" && canPay ? (
        <Button asChild block>
          <Link href={billing}>{t("action")}</Link>
        </Button>
      ) : null}
    </section>
  );
}
