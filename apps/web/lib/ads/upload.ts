"use client";

import { uuidV4 } from "@/lib/desk/uuid";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Limites des fichiers (vérifiées aussi par la base pour les images et le logo des pièces). */
export const AD_FILE_LIMITS = {
  image: 250 * 1024,
  video: 5 * 1024 * 1024,
  logo: 20 * 1024,
  document: 10 * 1024 * 1024,
} as const;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

/**
 * Dépôt d'un fichier publicitaire dans `<propriétaire>/<campagne>/<uuid>.<ext>` (politiques de stockage : membres de
 * l'annonceur ou administrateurs de l'établissement). Renvoie le chemin, ou une erreur de taille ou de type.
 */
export async function uploadAdFile(
  bucket: "ad-creatives" | "ad-documents",
  owner: string,
  campaignId: string,
  file: File,
  maxBytes: number,
): Promise<{ ok: true; path: string } | { ok: false; error: "file_too_large" | "generic" }> {
  if (file.size > maxBytes) return { ok: false, error: "file_too_large" };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: "generic" };
  const path = `${owner}/${campaignId}/${uuidV4()}.${ext}`;
  const { error } = await getSupabaseBrowserClient().storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  return error ? { ok: false, error: "generic" } : { ok: true, path };
}
