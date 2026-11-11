"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Banknote, CheckCircle2 } from "lucide-react";
import { MANUAL_PAYMENT_METHODS, manualPaymentSchema, type ManualPaymentMethod } from "@nextin/shared/schemas";
import { cancelManualPayment, recordManualPayment } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { useMfaStepUp } from "@/components/security/use-mfa-step-up";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import type { ErrorCode } from "@/lib/auth/errors";

/**
 * C1 — paiement reçu hors ligne pour une facture ouverte. Une action principale (« Enregistrer le paiement ») ;
 * même schéma Zod dans le navigateur (la saisie reste en place) et sur le serveur.
 */
export function ManualPaymentForm({ invoiceId, total, totalLabel, today }: { invoiceId: string; total: number; totalLabel: string; today: string }) {
  const t = useTranslations("platform.manual");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(recordManualPayment, null);
  const { field: serverField, top } = useFormErrors(state);
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const field = (name: string) => {
    const code = clientErrors[name];
    if (!code) return serverField(name);
    return te.has(code as ErrorCode) ? te(code as ErrorCode) : te("generic");
  };
  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const parsed = manualPaymentSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    const errors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    else if (parsed.data.amountXaf !== total) errors.amountXaf = "amount_mismatch";
    setClientErrors(errors);
    if (Object.keys(errors).length) e.preventDefault();
  };

  return (
    <form action={action} onSubmit={validate} noValidate className="flex flex-col gap-5">
      <FormError message={top} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <ListSection header={t("method")} radioGroupLabel={t("method")}>
        {MANUAL_PAYMENT_METHODS.map((m) => (
          <ListRow key={m} role="radio" selected={method === m} onClick={() => setMethod(m)} title={t(`methods.${m}`)} accessory="check" />
        ))}
      </ListSection>
      <input type="hidden" name="method" value={method} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          name="amountXaf"
          type="number"
          inputMode="numeric"
          min={1}
          label={t("amount")}
          defaultValue={total}
          hint={t("amountHint", { total: totalLabel })}
          required
          error={field("amountXaf")}
        />
        <TextField name="paidOn" type="date" max={today} label={t("paidOn")} defaultValue={today} required error={field("paidOn")} />
      </div>
      <TextField
        name="reference"
        label={t("reference")}
        hint={t("referenceHint")}
        maxLength={80}
        autoComplete="off"
        required={method !== "cash"}
        error={field("reference")}
      />
      <TextField name="note" label={t("note")} maxLength={300} autoComplete="off" error={field("note")} />
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={t("submitting")} leadingIcon={<Banknote aria-hidden className="size-5" />}>
          {t("submit")}
        </Button>
      </BottomBar>
    </form>
  );
}

/** C1 — annulation d'un paiement manuel : motif obligatoire, code de double authentification récent si exigé. */
export function CancelManualPayment({ manualPaymentId, invoiceId }: { manualPaymentId: string; invoiceId: string }) {
  const t = useTranslations("platform.manual");
  const te = useTranslations("errors");
  const toast = useToast();
  const stepUp = useMfaStepUp();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section aria-labelledby="manual-cancel" className="flex flex-col gap-3">
      {stepUp.dialog}
      <div className="flex flex-col gap-1 px-4">
        <h2 id="manual-cancel" className="text-title3 font-bold">
          {t("cancelTitle")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("cancelHint")}</p>
      </div>
      <TextField label={t("cancelReason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required error={error ?? undefined} />
      <Button
        type="button"
        variant="destructive"
        className="self-start"
        loading={pending}
        onClick={() =>
          start(async () => {
            if (reason.trim().length < 3) return setError(te("reason_required"));
            setError(null);
            const r = await stepUp.run(() => cancelManualPayment(manualPaymentId, reason, invoiceId));
            if (!r.ok) setError(te(r.error));
            else toast(t("cancelled"), <CheckCircle2 aria-hidden />);
          })
        }
      >
        {t("cancelSubmit")}
      </Button>
    </section>
  );
}
