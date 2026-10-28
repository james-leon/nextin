"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { applyDiscount, changePlan, grantDays, setSuspension } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import type { ActionResult } from "@/lib/auth/errors";

type Props = {
  subscriptionId: string;
  organizationId: string;
  planId: string;
  plans: { id: string; name: string }[];
  suspendedForModeration: boolean;
};

/** Actions du super admin sur un abonnement, chacune avec un motif obligatoire (journal d'audit). */
export function SubscriptionActions({ subscriptionId, organizationId, planId, plans, suspendedForModeration }: Props) {
  const t = useTranslations("platform");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <ActionCard title={t("grantDays")} action={grantDays} submit={t("grant")}>
        {(field) => (
          <>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <TextField name="days" type="number" inputMode="numeric" min={1} max={365} defaultValue={7} label={t("days")} error={field("days")} />
            <Reason field={field} />
          </>
        )}
      </ActionCard>
      <DiscountCard subscriptionId={subscriptionId} organizationId={organizationId} />
      <ActionCard title={t("changePlan")} action={changePlan} submit={t("apply")}>
        {(field) => (
          <>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <SelectField name="planId" label={t("plan")} defaultValue={planId} options={plans.map((p) => ({ value: p.id, label: p.name }))} />
            <Reason field={field} />
          </>
        )}
      </ActionCard>
      <ModerationCard subscriptionId={subscriptionId} organizationId={organizationId} suspended={suspendedForModeration} />
    </div>
  );
}

function Reason({ field }: { field: (name: string) => string | undefined }) {
  const t = useTranslations("platform");
  return <TextField name="reason" label={t("reason")} hint={t("reasonHint")} maxLength={200} required error={field("reason")} />;
}

function ActionCard({
  title,
  action,
  submit,
  destructive,
  children,
}: {
  title: string;
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  submit: string;
  destructive?: boolean;
  children: (field: (name: string) => string | undefined) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  return (
    <form action={formAction} noValidate className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <h3 className="text-headline">{title}</h3>
      <FormError message={top} />
      {children(field)}
      <Button type="submit" variant={destructive ? "destructive" : "tinted"} size="md" loading={pending}>
        {submit}
      </Button>
    </form>
  );
}

function DiscountCard({ subscriptionId, organizationId }: { subscriptionId: string; organizationId: string }) {
  const t = useTranslations("platform");
  const [kind, setKind] = useState<"percent" | "fixed_xaf">("percent");
  return (
    <ActionCard title={t("discountTitle")} action={applyDiscount} submit={t("applyDiscount")}>
      {(field) => (
        <>
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <SegmentedControl
            label={t("discountKind")}
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "percent", label: t("percent") },
              { value: "fixed_xaf", label: t("fixed") },
            ]}
          />
          <input type="hidden" name="kind" value={kind} />
          <div className="grid grid-cols-2 gap-3">
            <TextField name="value" type="number" inputMode="numeric" min={1} label={t("value")} defaultValue={kind === "percent" ? 10 : 5000} key={kind} error={field("value")} />
            <TextField name="invoices" type="number" inputMode="numeric" min={1} max={24} label={t("invoicesCount")} defaultValue={1} error={field("invoices")} />
          </div>
          <Reason field={field} />
        </>
      )}
    </ActionCard>
  );
}

function ModerationCard({ subscriptionId, organizationId, suspended }: { subscriptionId: string; organizationId: string; suspended: boolean }) {
  const t = useTranslations("platform");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(setSuspension, null);
  const { field, top } = useFormErrors(state);
  const [confirm, setConfirm] = useState(false);
  const confirmed = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={formAction}
      noValidate
      className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card"
      onSubmit={(e) => {
        // Suspendre : confirmation iOS avant l'envoi.
        if (!suspended && !confirmed.current) {
          e.preventDefault();
          setConfirm(true);
        }
        confirmed.current = false;
      }}
    >
      <h3 className="text-headline">{t("moderation")}</h3>
      <FormError message={top} />
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="suspended" value={suspended ? "false" : "true"} />
      <Reason field={field} />
      <Button type="submit" variant={suspended ? "tinted" : "destructive"} size="md" loading={pending}>
        {suspended ? t("reactivate") : t("suspend")}
      </Button>
      <AlertDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("suspendConfirmTitle")}
        description={t("suspendConfirmBody")}
        cancelLabel={ta("cancel")}
        actionLabel={t("suspend")}
        destructive
        onAction={() => {
          confirmed.current = true;
          form.current?.requestSubmit();
        }}
      />
    </form>
  );
}
