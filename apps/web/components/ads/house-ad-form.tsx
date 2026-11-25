"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus } from "lucide-react";
import { createHouseDraft, publishHouseAd } from "@/app/(staff)/app/o/[orgId]/_actions/ads";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { FormGroup, TextField } from "@/components/ui/text-field";
import type { ActionResult } from "@/lib/auth/errors";
import { AD_FILE_LIMITS, uploadAdFile } from "@/lib/ads/upload";
import { AdPreview } from "./ad-preview";

/**
 * Annonce Maison (maquette v2 24, P11) : aperçu TV au nom de l'établissement, titre, offre et visuel obligatoire,
 * puis « Publier l'annonce » (diffusée tout de suite, sans validation Wintek). Le brouillon est créé au choix du
 * visuel (son fichier est rangé dans le dossier de l'annonce).
 */
export function HouseAdForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const t = useTranslations("adPrefs");
  const ta = useTranslations("ads");
  const te = useTranslations("errors");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [offer, setOffer] = useState("");
  const [path, setPath] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    (prev: ActionResult | null, data: FormData) =>
      campaignId ? publishHouseAd(orgId, campaignId, prev, data) : Promise.resolve<ActionResult>({ ok: false, error: "creative_required" }),
    null,
  );
  const { field, top } = useFormErrors(state);

  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    if (file.size > AD_FILE_LIMITS.image) return setUploadError(ta("tooLarge", { max: "250 Ko" }));
    if (title.trim().length < 2) return setUploadError(te("name_too_short"));
    setUploading(true);
    let id = campaignId;
    if (!id) {
      const draft = await createHouseDraft(orgId, title);
      if (!draft.ok) {
        setUploading(false);
        return setUploadError(te(draft.error));
      }
      id = draft.campaignId;
      setCampaignId(id);
    }
    setLocal(URL.createObjectURL(file));
    const r = await uploadAdFile("ad-creatives", `org-${orgId}`, id, file, AD_FILE_LIMITS.image);
    setUploading(false);
    if (r.ok) setPath(r.path);
    else setUploadError(r.error === "file_too_large" ? ta("tooLarge", { max: "250 Ko" }) : te("generic"));
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <AdPreview src={local} tag={orgName} headline={title} offer={offer} empty={ta("wizard.creativesEmpty")} />
      <FormError message={top ?? uploadError} />
      <FormGroup>
        <TextField grouped name="title" label={ta("headline")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required error={field("title")} />
        <TextField grouped name="offer" label={ta("offer")} value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={140} />
      </FormGroup>
      <div className="flex flex-col gap-1.5">
        <div className="squircle overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary">
          <label className="pressable flex min-h-11 cursor-pointer items-center gap-3 px-4 text-accent-text">
            <ImagePlus aria-hidden className="size-5" />
            <span className="text-body">{uploading ? ta("uploading") : path ? t("houseVisualChange") : t("houseVisual")}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="house-visual" />
          </label>
        </div>
        <p className="px-4 text-footnote text-label-secondary">{path ? ta("creativesHint") : t("houseVisualRequired")}</p>
      </div>
      <input type="hidden" name="storagePath" value={path} />
      <BottomBar dock={false}>
        <Button type="submit" block loading={pending || uploading} loadingLabel={uploading ? ta("uploading") : t("publishing")} disabled={!path}>
          {t("publish")}
        </Button>
      </BottomBar>
    </form>
  );
}
