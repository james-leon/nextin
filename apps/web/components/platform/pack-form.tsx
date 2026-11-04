"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveQuotaPack } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";

export type PackFormValues = {
  id: string | null;
  code: string;
  kind: "tickets" | "whatsapp";
  quantity: number;
  price_xaf: number;
  name: string;
  name_en: string | null;
  active: boolean;
};

/** Extension de quota (pack de tickets ou de messages WhatsApp) : prix et quantité fixés ici, rien dans le code. */
export function PackForm({ pack }: { pack: PackFormValues }) {
  const t = useTranslations("platform");
  const ta = useTranslations("admin");
  const [state, action, pending] = useActionState(saveQuotaPack, null);
  const { field, top } = useFormErrors(state);
  const [kind, setKind] = useState(pack.kind);
  const [active, setActive] = useState(pack.active);
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <input type="hidden" name="packId" value={pack.id ?? ""} />
      {pack.id ? null : (
        <>
          <TextField name="code" label={t("packFields.code")} defaultValue={pack.code} required error={field("code")} />
          <SegmentedControl
            label={t("packFields.kind")}
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "tickets", label: t("packFields.kindTickets") },
              { value: "whatsapp", label: t("packFields.kindWhatsapp") },
            ]}
          />
          <input type="hidden" name="kind" value={kind} />
        </>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField name="name" label={t("packFields.name")} defaultValue={pack.name} required error={field("name")} />
        <TextField name="nameEn" label={t("packFields.nameEn")} defaultValue={pack.name_en ?? ""} error={field("nameEn")} />
        <TextField name="quantity" type="number" inputMode="numeric" min={1} label={t("packFields.quantity")} defaultValue={pack.quantity} error={field("quantity")} />
        <TextField name="priceXaf" type="number" inputMode="numeric" min={0} label={t("packFields.price")} defaultValue={pack.price_xaf} error={field("priceXaf")} />
      </div>
      <ListSection footer={t("packsFooter")}>
        <ListSwitchRow title={t("packFields.active")} checked={active} onCheckedChange={setActive} />
      </ListSection>
      <input type="hidden" name="active" value={active ? "true" : "false"} />
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      </BottomBar>
    </form>
  );
}
