"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { adFileUrl } from "@nextin/shared/ads";
import { deleteCreative, saveCreative } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button, IconButton } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import type { CreativeRow } from "@/lib/ads/types";
import { AD_FILE_LIMITS, uploadAdFile } from "@/lib/ads/upload";

type Props = {
  campaignId: string;
  /** Dossier de stockage : identifiant de l'annonceur, ou `org-<établissement>` (annonce Maison). */
  owner: string;
  creatives: CreativeRow[];
  editable: boolean;
  /** TV seulement : la vidéo est permise. */
  videoAllowed: boolean;
  supabaseUrl: string;
};

/** Visuels d'une campagne : aperçus, ajout et modification dans une feuille, suppression confirmée. */
export function CreativesSection({ campaignId, owner, creatives, editable, videoAllowed, supabaseUrl }: Props) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const [editing, setEditing] = useState<CreativeRow | "new" | null>(null);
  return (
    <section aria-labelledby="creatives-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-4">
        <h2 id="creatives-title" className="text-title3 font-bold">
          {t("creatives")}
        </h2>
        {editable && creatives.length < 5 ? (
          <Button variant="gray" size="md" leadingIcon={<ImagePlus />} onClick={() => setEditing("new")}>
            {t("addCreative")}
          </Button>
        ) : null}
      </div>
      <p className="px-4 text-footnote text-label-secondary">{t("creativesHint")}</p>
      <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {creatives.map((c) => (
          <li key={c.id} className="squircle flex flex-col overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
            <div className="relative aspect-video bg-fill-tertiary">
              {c.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- fichier du stockage public, dimensions variables
                <img src={adFileUrl(supabaseUrl, c.storage_path)} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
              ) : (
                <video src={adFileUrl(supabaseUrl, c.storage_path)} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
              )}
            </div>
            {/* Texte sur toute la largeur de la carte, actions en dessous : rien n'écrase le titre dans une carte étroite. */}
            <div className="flex flex-col gap-1 p-4">
              <div className="min-w-0">
                <p className="truncate text-headline">{c.headline}</p>
                {c.offer_text ? <p className="truncate text-subheadline text-label-secondary">{c.offer_text}</p> : null}
                <p className="text-footnote text-label-secondary">
                  {c.kind === "image" ? t("image") : t("video")} · {c.duration_seconds} s
                </p>
              </div>
              {editable ? (
                <div className="-mr-2 -mb-2 flex flex-wrap items-center justify-end gap-1">
                  <IconButton label={t("editCreative")} icon={<Pencil />} variant="plain" onClick={() => setEditing(c)} />
                  <ConfirmAction
                    action={deleteCreative.bind(null, campaignId, c.id)}
                    label={t("deleteCreative")}
                    title={t("deleteCreative")}
                    body={c.headline}
                    confirmLabel={ta("delete")}
                    variant="destructive-plain"
                    block={false}
                    size="md"
                    icon={<Trash2 />}
                  />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <CreativeSheet
          key={editing === "new" ? "new" : editing.id}
          campaignId={campaignId}
          owner={owner}
          creative={editing === "new" ? null : editing}
          videoAllowed={videoAllowed}
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
  onClose,
}: {
  campaignId: string;
  owner: string;
  creative: CreativeRow | null;
  videoAllowed: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("ads");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveCreative.bind(null, campaignId, creative?.id ?? null), null);
  const { field, top } = useFormErrors(state);
  const [kind, setKind] = useState<"image" | "video">(creative?.kind ?? "image");
  const [path, setPath] = useState(creative?.storage_path ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const max = kind === "image" ? AD_FILE_LIMITS.image : AD_FILE_LIMITS.video;
    const result = await uploadAdFile("ad-creatives", owner, campaignId, file, max);
    setUploading(false);
    if (result.ok) setPath(result.path);
    else setUploadError(result.error === "file_too_large" ? t("tooLarge", { max: kind === "image" ? "250 Ko" : "5 Mo" }) : te("generic"));
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
        <FormError message={top ?? uploadError} />
        {videoAllowed ? (
          <SegmentedControl
            label={t("kind")}
            value={kind}
            onValueChange={(k) => {
              setKind(k);
              setPath("");
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
          hint={path ? path.split("/").pop() : t("creativesHint")}
          className="[&_input]:pt-2.5"
        />
        <TextField name="headline" label={t("headline")} defaultValue={creative?.headline ?? ""} maxLength={80} required error={field("headline")} />
        <TextField name="offerText" label={t("offer")} placeholder={t("offerPlaceholder")} defaultValue={creative?.offer_text ?? ""} maxLength={140} error={field("offerText")} />
        <TextField name="ctaUrl" type="url" inputMode="url" label={t("ctaUrl")} defaultValue={creative?.cta_url ?? ""} maxLength={300} error={field("ctaUrl")} />
        <TextField name="durationSeconds" type="number" inputMode="numeric" min={5} max={15} label={t("duration")} defaultValue={creative?.duration_seconds ?? 8} error={field("durationSeconds")} />
      </form>
    </Sheet>
  );
}
