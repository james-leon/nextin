"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { UsersRound } from "lucide-react";
import { addCashier, removeCashier } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSection } from "@/components/ui/list";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { initialsOf } from "@/lib/text/initials";

type Cashier = { user_id: string; email: string; since: string };

/**
 * Caissiers d'un annonceur (maquette v2 24) : la liste et l'ajout sur le même écran. Chaque caissier : initiales,
 * adresse, « Validation des bons seulement » et « Retirer » (rouge, confirmé). Ajout par l'adresse d'un compte NextIn.
 */
export function CashiersManager({ advertiserId, cashiers }: { advertiserId: string; cashiers: Cashier[] }) {
  const t = useTranslations("ads");
  const [state, action, pending] = useActionState(addCashier.bind(null, advertiserId), null);
  const { field, top } = useFormErrors(state);
  return (
    <div className="flex flex-col gap-6">
      {cashiers.length ? (
        <ListSection>
          {cashiers.map((c) => (
            <li key={c.user_id} className="group/row flex items-center gap-3 pl-4" data-testid="cashier-row">
              <span aria-hidden className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-on-accent">
                {initialsOf(c.email.split("@")[0]!.replace(/[._-]+/g, " "))}
              </span>
              <span className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2 list-separator">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{c.email}</span>
                  <span className="text-subheadline text-label-secondary">{t("cashierRole")}</span>
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
      ) : (
        <ListSection>
          <EmptyState variant="inline" title={t("cashiersEmpty")} icon={<UsersRound />} />
        </ListSection>
      )}
      <form action={action} noValidate className="flex flex-col gap-1.5">
        <FormError message={top} />
        <FormGroup>
          <TextField grouped name="email" type="email" inputMode="email" autoComplete="off" label={t("cashierEmail")} required error={field("email")} />
        </FormGroup>
        <p className="px-4 text-footnote text-label-secondary">{t("cashierHint")}</p>
        <BottomBar dock={false}>
          <Button type="submit" variant="tinted" block loading={pending} loadingLabel={t("adding")}>
            {t("addCashier")}
          </Button>
        </BottomBar>
      </form>
    </div>
  );
}
