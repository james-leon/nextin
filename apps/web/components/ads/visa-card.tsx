"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { saveVisa } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { TextField } from "@/components/ui/text-field";
import { AD_FILE_LIMITS, uploadAdFile } from "@/lib/ads/upload";

/** Visa du ministère de la Santé (santé, pharmacie) : numéro et justificatif, obligatoires avant la validation. */
export function VisaCard({
  campaignId,
  owner,
  number,
  hasDocument,
  editable,
}: {
  campaignId: string;
  owner: string;
  number: string | null;
  hasDocument: boolean;
  editable: boolean;
}) {
  const t = useTranslations("ads");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(saveVisa.bind(null, campaignId), null);
  const { field, top } = useFormErrors(state);
  const [path, setPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const r = await uploadAdFile("ad-documents", owner, campaignId, file, AD_FILE_LIMITS.document);
    setUploading(false);
    if (r.ok) setPath(r.path);
    else setUploadError(r.error === "file_too_large" ? t("tooLarge", { max: "10 Mo" }) : te("generic"));
  }

  return (
    <section aria-labelledby="visa-title" className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <h2 id="visa-title" className="flex items-center gap-2 text-headline">
        <ShieldCheck aria-hidden className="size-5 text-accent-text" />
        {t("visaTitle")}
      </h2>
      <p className="text-subheadline text-label-secondary">{t("visaBody")}</p>
      {!editable ? (
        <p className="text-body">
          {number ?? "—"} {hasDocument ? <span className="text-green-text">· {t("visaUploaded")}</span> : null}
        </p>
      ) : (
        <form action={action} noValidate className="flex flex-col gap-4">
          <FormError message={top ?? uploadError} />
          <TextField name="number" label={t("visaNumber")} defaultValue={number ?? ""} maxLength={60} required error={field("number")} />
          <TextField type="file" accept="application/pdf,image/jpeg,image/png" label={t("visaDocument")} onChange={(e) => onFile(e.target.files?.[0])} className="[&_input]:pt-2.5" />
          <input type="hidden" name="path" value={path} />
          {hasDocument && !path ? (
            <CalloutCard tone="green" icon={<CheckCircle2 />}>
              {t("visaUploaded")}
            </CalloutCard>
          ) : null}
          <Button type="submit" variant="tinted" loading={pending || uploading} loadingLabel={uploading ? t("uploading") : t("saving")} className="self-start">
            {t("save")}
          </Button>
        </form>
      )}
    </section>
  );
}
