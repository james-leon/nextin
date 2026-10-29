"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { adFileUrl } from "@nextin/shared/ads";
import { deleteSkin, saveSkin } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import type { SkinRow } from "@/lib/ads/types";
import { AD_FILE_LIMITS, uploadAdFile } from "@/lib/ads/upload";

/** Habillage de Sky Catch (formule Or) : couleurs de l'avion, logo des pièces, écran de fin et bon de réduction. */
export function SkinEditor({
  campaignId,
  owner,
  skin,
  editable,
  supabaseUrl,
}: {
  campaignId: string;
  owner: string;
  skin: SkinRow | null;
  editable: boolean;
  supabaseUrl: string;
}) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveSkin.bind(null, campaignId), null);
  const { field, top } = useFormErrors(state);
  const [primary, setPrimary] = useState(skin?.plane_primary ?? "#1A6BB5");
  const [secondary, setSecondary] = useState(skin?.plane_secondary ?? "#F58B1F");
  const [logo, setLogo] = useState(skin?.coin_logo_path ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const r = await uploadAdFile("ad-creatives", owner, campaignId, file, AD_FILE_LIMITS.logo);
    setUploading(false);
    if (r.ok) setLogo(r.path);
    else setUploadError(r.error === "file_too_large" ? t("tooLarge", { max: "20 Ko" }) : te("generic"));
  }

  return (
    <section aria-labelledby="skin-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-4">
        <h2 id="skin-title" className="text-title3 font-bold">
          {t("skin")}
        </h2>
        {editable ? (
          <Button variant="gray" size="md" onClick={() => setOpen(true)}>
            {skin ? t("editSkin") : t("createSkin")}
          </Button>
        ) : null}
      </div>
      {skin ? (
        <ListSection>
          <ListRow
            icon={
              <span aria-hidden className="flex size-9 shrink-0 overflow-hidden rounded-full shadow-card">
                <span className="flex-1" style={{ background: skin.plane_primary }} />
                <span className="flex-1" style={{ background: skin.plane_secondary }} />
              </span>
            }
            title={skin.end_title}
            subtitle={`${skin.reward_text} · ${t("minLevels")} : ${skin.min_levels}`}
            accessory={
              skin.coin_logo_path ? (
                // eslint-disable-next-line @next/next/no-img-element -- petit logo du stockage public
                <img src={adFileUrl(supabaseUrl, skin.coin_logo_path)} alt="" className="size-8 rounded-full object-cover" />
              ) : undefined
            }
          />
        </ListSection>
      ) : (
        <p className="px-4 text-footnote text-label-secondary">{t("skinHint")}</p>
      )}
      {skin && editable ? (
        <ConfirmAction action={deleteSkin.bind(null, campaignId)} label={t("deleteSkin")} title={t("deleteSkin")} body={skin.end_title} confirmLabel={ta("delete")} size="md" />
      ) : null}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={skin ? t("editSkin") : t("createSkin")}
        description={t("skinHint")}
        closeLabel={tc("close")}
        footer={
          <Button type="submit" form="skin-form" block loading={pending || uploading} loadingLabel={uploading ? t("uploading") : t("saving")}>
            {t("save")}
          </Button>
        }
      >
        <form id="skin-form" action={action} noValidate className="flex flex-col gap-5 pt-2">
          <FormError message={top ?? uploadError} />
          <div className="grid grid-cols-2 gap-3">
            <TextField type="color" name="planePrimary" label={t("planePrimary")} value={primary} onChange={(e) => setPrimary(e.target.value.toUpperCase())} className="[&_input]:p-1" />
            <TextField type="color" name="planeSecondary" label={t("planeSecondary")} value={secondary} onChange={(e) => setSecondary(e.target.value.toUpperCase())} className="[&_input]:p-1" />
          </div>
          <TextField type="file" accept="image/png,image/webp" label={t("coinLogo")} onChange={(e) => onLogo(e.target.files?.[0])} hint={logo ? logo.split("/").pop() : undefined} className="[&_input]:pt-2.5" />
          <input type="hidden" name="coinLogoPath" value={logo} />
          <TextField name="endTitle" label={t("endTitle")} defaultValue={skin?.end_title ?? ""} maxLength={80} required error={field("endTitle")} />
          <TextField name="rewardText" label={t("reward")} placeholder={t("rewardPlaceholder")} defaultValue={skin?.reward_text ?? ""} maxLength={120} required error={field("rewardText")} />
          <div className="grid grid-cols-3 gap-3">
            <TextField name="minLevels" type="number" inputMode="numeric" min={1} max={10} label={t("minLevels")} defaultValue={skin?.min_levels ?? 2} />
            <TextField name="couponValidityDays" type="number" inputMode="numeric" min={1} max={365} label={t("couponValidity")} defaultValue={skin?.coupon_validity_days ?? 30} />
            <TextField name="maxCoupons" type="number" inputMode="numeric" min={1} label={t("maxCoupons")} defaultValue={skin?.max_coupons ?? ""} />
          </div>
        </form>
      </Sheet>
    </section>
  );
}
