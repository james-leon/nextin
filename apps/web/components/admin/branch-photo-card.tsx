"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const MAX_BYTES = 1024 * 1024;

/** Recadrage centré à la proportion voulue, en WebP, sous 1 Mo (qualité réduite au besoin). */
async function cropToWebp(image: ImageBitmap, width: number, height: number): Promise<Blob> {
  const ratio = width / height;
  const sw = Math.min(image.width, image.height * ratio);
  const sh = sw / ratio;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, width, height);
  // Photo légère pour la 3G : qualité modérée d'abord.
  for (const quality of [0.75, 0.62, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("too_large");
}

/**
 * Photo de l'établissement (page « À proximité ») : choisie par le directeur ou le responsable d'agence, recadrée
 * dans le navigateur (16:9 pour la grande carte, carrée pour la vignette), téléversée dans le bucket public
 * `branch-photos`. Sans photo, l'application affiche l'icône du secteur.
 */
export function BranchPhotoCard({
  orgId,
  branchId,
  photoUrl,
  canManage,
}: {
  orgId: string;
  branchId: string;
  photoUrl: string | null;
  canManage: boolean;
}) {
  const t = useTranslations("branches");
  const te = useTranslations("errors");
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);

  async function upload(file: File) {
    setPending("upload");
    try {
      const image = await createImageBitmap(file);
      const [cover, thumb] = await Promise.all([cropToWebp(image, 960, 540), cropToWebp(image, 320, 320)]);
      const supabase = getSupabaseBrowserClient();
      const bucket = supabase.storage.from("branch-photos");
      for (const [name, blob] of [["cover.webp", cover], ["thumb.webp", thumb]] as const) {
        const { error } = await bucket.upload(`${orgId}/${branchId}/${name}`, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
        if (error) throw error;
      }
      const { error } = await supabase.rpc("set_branch_photo", { p_branch: branchId, p_present: true });
      if (error) throw error;
      toast(t("photoSaved"));
      router.refresh();
    } catch {
      toast(te("generic"));
    } finally {
      setPending(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setPending("remove");
    const supabase = getSupabaseBrowserClient();
    await supabase.storage.from("branch-photos").remove([`${orgId}/${branchId}/cover.webp`, `${orgId}/${branchId}/thumb.webp`]);
    const { error } = await supabase.rpc("set_branch_photo", { p_branch: branchId, p_present: false });
    setPending(null);
    if (error) return toast(te("generic"));
    router.refresh();
  }

  return (
    <section aria-labelledby="branch-photo" className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <div>
        <h2 id="branch-photo" className="text-headline">
          {t("photo")}
        </h2>
        <p className="text-subheadline text-label-secondary">{t("photoHint")}</p>
      </div>
      <div className={cn("squircle relative aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)]", !photoUrl && "bg-fill-tertiary")}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={t("photoAlt")} className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-subheadline text-label-secondary">{t("photoEmpty")}</span>
        )}
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label={t("photoChoose")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button variant="tinted" size="md" leadingIcon={<ImagePlus aria-hidden className="size-5" />} loading={pending === "upload"} onClick={() => input.current?.click()}>
            {photoUrl ? t("photoReplace") : t("photoChoose")}
          </Button>
          {photoUrl ? (
            <Button variant="destructive-plain" size="md" leadingIcon={<Trash2 aria-hidden className="size-5" />} loading={pending === "remove"} onClick={remove}>
              {t("photoRemove")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
