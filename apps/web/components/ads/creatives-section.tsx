"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adFileUrl } from "@nextin/shared/ads";
import { deleteCreative, saveCreative } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button, IconButton } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import type { CreativeRow } from "@/lib/ads/types";
import { AD_FILE_LIMITS, uploadAdFile } from "@/lib/ads/upload";
import { AdPreview } from "./ad-preview";

type Props = {
  campaignId: string;
  /** Dossier de stockage : identifiant de l'annonceur, ou `org-<établissement>` (annonce Maison). */
  owner: string;
  creatives: CreativeRow[];
  editable: boolean;
  /** TV seulement : la vidéo est permise. */
  videoAllowed: boolean;
  supabaseUrl: string;
  /** Étiquette de l'aperçu : « Publicité », ou le nom de l'établissement (annonce Maison). */
  tag?: string;
  /** Parcours en étapes : étape où revenir après l'enregistrement. */
  returnTo?: string;
};

/**
 * Visuels d'une campagne (maquette v2 24, étape 3) : chaque visuel dans l'aperçu de l'écran TV, puis la ligne
 * « + Ajouter un visuel » et l'aide sur les formats. Ajout et modification dans une feuille avec aperçu en direct ;
 * suppression confirmée. Poids vérifié avant l'envoi, puis par la base.
 */
export function CreativesSection({ campaignId, owner, creatives, editable, videoAllowed, supabaseUrl, tag, returnTo }: Props) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const [editing, setEditing] = useState<CreativeRow | "new" | null>(null);
  const label = tag ?? t("wizard.previewTag");
  return (
    <section aria-label={t("creatives")} className="flex flex-col gap-4">
      {creatives.length ? (
        <ul role="list" className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          {creatives.map((c) => (
            <li key={c.id} className="flex flex-col gap-2">
              <AdPreview src={adFileUrl(supabaseUrl, c.storage_path)} video={c.kind === "video"} tag={label} headline={c.headline} offer={c.offer_text} />
              <div className="flex items-center gap-1 px-1">
                <p className="min-w-0 flex-1 text-footnote text-label-secondary">
                  {c.kind === "image" ? t("image") : t("video")} · {c.duration_seconds} s
                </p>
                {editable ? (
                  <>
                    <IconButton label={t("editCreative")} icon={<Pencil />} variant="plain" onClick={() => setEditing(c)} />
                    <ConfirmAction
                      action={deleteCreative.bind(null, campaignId, c.id, returnTo)}
                      label={t("deleteCreative")}
                      title={t("deleteCreative")}
                      body={c.headline}
                      confirmLabel={ta("delete")}
                      variant="destructive-plain"
                      block={false}
                      size="md"
                      icon={<Trash2 />}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <AdPreview tag={label} empty={t("wizard.creativesEmpty")} />
      )}
      {editable && creatives.length < 5 ? (
        <ListSection footer={t("creativesHint")}>
          <ListRow
            onClick={() => setEditing("new")}
            icon={<Plus aria-hidden className="size-5 stroke-[2.25] text-accent-text" />}
            title={<span className="text-accent-text">{t("addCreative")}</span>}
          />
        </ListSection>
      ) : (
        <p className="px-4 text-footnote text-label-secondary">{t("creativesHint")}</p>
      )}
      {editing ? (
        <CreativeSheet
          key={editing === "new" ? "new" : editing.id}
          campaignId={campaignId}
          owner={owner}
          creative={editing === "new" ? null : editing}
          videoAllowed={videoAllowed}
          supabaseUrl={supabaseUrl}
          tag={label}
          returnTo={returnTo}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}

function CreativeSheet({
  campaignId,
  owner,
  creative,
  videoAllowed,
  supabaseUrl,
  tag,
  returnTo,
  onClose,
}: {
  campaignId: string;
  owner: string;
  creative: CreativeRow | null;
  videoAllowed: boolean;
  supabaseUrl: string;
  tag: string;
  returnTo?: string;
  onClose: () => void;
}) {
  const t = useTranslations("ads");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveCreative.bind(null, campaignId, creative?.id ?? null), null);
  const { field, top } = useFormErrors(state);
  const [kind, setKind] = useState<"image" | "video">(creative?.kind ?? "image");
  const [path, setPath] = useState(creative?.storage_path ?? "");
  const [local, setLocal] = useState<string | null>(null);
  const [headline, setHeadline] = useState(creative?.headline ?? "");
  const [offer, setOffer] = useState(creative?.offer_text ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Aperçu du fichier choisi, libéré à la fermeture ou au changement de fichier.
  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    const max = kind === "image" ? AD_FILE_LIMITS.image : AD_FILE_LIMITS.video;
    const tooLarge = t("tooLarge", { max: kind === "image" ? "250 Ko" : "5 Mo" });
    // Poids vérifié avant l'envoi (la base le vérifie aussi pour les images).
    if (file.size > max) return setUploadError(tooLarge);
    setLocal(URL.createObjectURL(file));
    setUploading(true);
    const result = await uploadAdFile("ad-creatives", owner, campaignId, file, max);
    setUploading(false);
    if (result.ok) setPath(result.path);
    else setUploadError(result.error === "file_too_large" ? tooLarge : te("generic"));
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={creative ? t("editCreative") : t("addCreative")}
      closeLabel={tc("close")}
      footer={
        <Button type="submit" form="creative-form" block loading={pending || uploading} loadingLabel={uploading ? t("uploading") : t("saving")} disabled={!path}>
          {t("save")}
        </Button>
      }
    >
      <form id="creative-form" action={action} noValidate className="flex flex-col gap-5 pt-2">
        <AdPreview
          src={local ?? (path ? adFileUrl(supabaseUrl, path) : null)}
          video={kind === "video"}
          tag={tag}
          headline={headline}
          offer={offer}
          empty={t("wizard.creativesEmpty")}
        />
        <FormError message={top ?? uploadError} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        {videoAllowed ? (
          <SegmentedControl
            label={t("kind")}
            value={kind}
            onValueChange={(k) => {
              setKind(k);
              setPath("");
              setLocal(null);
            }}
            options={[
              { value: "image", label: t("image") },
              { value: "video", label: t("video") },
            ]}
          />
        ) : null}
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="storagePath" value={path} />
        <TextField
          type="file"
          label={t("file")}
          accept={kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4"}
          onChange={(e) => onFile(e.target.files?.[0])}
          hint={t("creativesHint")}
          className="[&_input]:pt-2.5"
        />
        <TextField name="headline" label={t("headline")} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} required error={field("headline")} />
        <TextField name="offerText" label={t("offer")} placeholder={t("offerPlaceholder")} value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={140} error={field("offerText")} />
        <TextField name="durationSeconds" type="number" inputMode="numeric" min={5} max={15} label={t("duration")} defaultValue={creative?.duration_seconds ?? 10} error={field("durationSeconds")} />
        <TextField name="ctaUrl" type="url" inputMode="url" label={t("ctaUrl")} defaultValue={creative?.cta_url ?? ""} maxLength={300} error={field("ctaUrl")} />
      </form>
    </Sheet>
  );
}
