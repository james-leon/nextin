"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { addCashier, removeCashier } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListIcon, ListSection } from "@/components/ui/list";
import { TextField } from "@/components/ui/text-field";

type Cashier = { user_id: string; email: string; since: string };

/** Caissiers d'un annonceur : ajout par adresse e-mail (compte existant), retrait confirmé. */
export function CashiersManager({ advertiserId, cashiers }: { advertiserId: string; cashiers: Cashier[] }) {
  const t = useTranslations("ads");
  const locale = useLocale();
  const [state, action, pending] = useActionState(addCashier.bind(null, advertiserId), null);
  const { field, top } = useFormErrors(state);
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" }).format(new Date(iso));
  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:items-start">
      <ListSection footer={cashiers.length ? undefined : t("cashiersEmpty")}>
        {cashiers.map((c) => (
          <li key={c.user_id} className="group/row flex items-center gap-3 pl-4">
            <ListIcon color="var(--brand-tile)">
              <UserRound />
            </ListIcon>
            <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2 list-separator">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{c.email}</span>
                <span className="text-subheadline text-label-secondary">{day(c.since)}</span>
              </span>
              <ConfirmAction
                action={removeCashier.bind(null, advertiserId, c.user_id)}
                label={t("removeCashier")}
                title={t("removeCashierTitle")}
                body={c.email}
                confirmLabel={t("removeCashier")}
                variant="destructive-plain"
                block={false}
                size="md"
              />
            </span>
          </li>
        ))}
      </ListSection>
      <form action={action} noValidate className="flex flex-col gap-4">
        <FormError message={top} />
        <TextField name="email" type="email" inputMode="email" autoComplete="off" label={t("cashierEmail")} required error={field("email")} />
        <BottomBar className="lg:static lg:bg-none lg:p-0">
          <Button type="submit" block loading={pending} loadingLabel={t("adding")}>
            {t("addCashier")}
          </Button>
        </BottomBar>
      </form>
    </div>
  );
}
