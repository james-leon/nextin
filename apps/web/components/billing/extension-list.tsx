"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle, Ticket } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { buyExtension } from "@/app/(staff)/app/o/[orgId]/_actions/billing";
import { FormError } from "@/components/auth/form-error";
import type { QuotaPack } from "@/lib/billing/types";

/** Extensions de quota (packs paramétrés par Wintek) : achat à l'unité, ajouté au mois en cours dès le paiement. */
export function ExtensionList({ orgId, packs }: { orgId: string; packs: QuotaPack[] }) {
  const t = useTranslations("billing");
  const te = useTranslations("errors");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [state, action, pending] = useActionState(buyExtension.bind(null, orgId), null);
  if (!packs.length) return null;
  const num = (n: number) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
  // Maquette v2 06 : « Besoin de plus ce mois-ci ? » puis une pastille par extension (quantité et prix), achat au clic.
  return (
    <div id="extensions" className="flex scroll-mt-20 flex-col gap-2 hairline-t pt-4">
      <FormError message={state && !state.ok ? te(state.error) : null} />
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <h3 className="text-subheadline font-semibold">{t("extensionsTitle")}</h3>
        <ul role="list" className="flex flex-wrap gap-2">
          {packs.map((p) => {
            const name = locale === "en" ? (p.name_en ?? p.name) : p.name;
            const price = formatXaf(p.price_xaf, locale);
            return (
              <li key={p.id}>
                <form action={action}>
                  <input type="hidden" name="packId" value={p.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    aria-label={t("buyPackLabel", { pack: name, amount: price })}
                    className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-fill-tertiary px-4 text-footnote text-label disabled:opacity-50"
                  >
                    <span aria-hidden className="text-label-secondary [&_svg]:size-4 [&_svg]:stroke-2">
                      {p.kind === "tickets" ? <Ticket /> : <MessageCircle />}
                    </span>
                    {p.kind === "tickets" ? t("packTickets", { count: num(p.quantity) }) : t("packWhatsapp", { count: num(p.quantity) })}
                    <span className="font-semibold text-accent-text tabular">{price}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-footnote text-label-secondary">{t("extensionsFooter")}</p>
    </div>
  );
}
