"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle, Ticket } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { buyExtension } from "@/app/(staff)/app/o/[orgId]/_actions/billing";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import type { QuotaPack } from "@/lib/billing/types";

/** Extensions de quota (packs paramétrés par Wintek) : achat à l'unité, ajouté au mois en cours dès le paiement. */
export function ExtensionList({ orgId, packs }: { orgId: string; packs: QuotaPack[] }) {
  const t = useTranslations("billing");
  const te = useTranslations("errors");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [state, action, pending] = useActionState(buyExtension.bind(null, orgId), null);
  if (!packs.length) return null;
  const num = (n: number) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
  return (
    <div id="extensions" className="flex scroll-mt-20 flex-col gap-2">
      <FormError message={state && !state.ok ? te(state.error) : null} />
      <ListSection header={t("extensionsTitle")} footer={t("extensionsFooter")}>
        {packs.map((p) => {
          const name = locale === "en" ? (p.name_en ?? p.name) : p.name;
          const price = formatXaf(p.price_xaf, locale);
          return (
            <ListRow
              key={p.id}
              icon={
                <ListIcon color={p.kind === "tickets" ? "var(--accent-fill)" : "var(--green-fill)"}>
                  {p.kind === "tickets" ? <Ticket /> : <MessageCircle />}
                </ListIcon>
              }
              title={name}
              subtitle={`${p.kind === "tickets" ? t("packTickets", { count: num(p.quantity) }) : t("packWhatsapp", { count: num(p.quantity) })} · ${price}`}
              accessory={
                <form action={action}>
                  <input type="hidden" name="packId" value={p.id} />
                  <Button type="submit" variant="tinted" size="md" disabled={pending} aria-label={t("buyPackLabel", { pack: name, amount: price })}>
                    {t("buyPack")}
                  </Button>
                </form>
              }
            />
          );
        })}
      </ListSection>
    </div>
  );
}
