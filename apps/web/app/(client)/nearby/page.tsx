import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientTabBar } from "@/components/client/client-tab-bar";
import { NearbyExplorer } from "@/components/client/nearby-explorer";
import { callRpc } from "@/lib/client/supabase-public";
import type { NearbyBranch } from "@/lib/client/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.nearby");
  return { title: t("title") };
}

/** Lecture à l'exécution : un accès calculé n'est pas remplacé au build (contrairement à `process.env.NEXT_PUBLIC_X`). */
function runtimeEnv(name: string): string | null {
  return process.env[name] || null;
}

/** « Établissements à proximité » (M9) : liste par ville au premier affichage, puis autour du client s'il le permet. */
export default async function NearbyPage() {
  const { data } = await callRpc<NearbyBranch[]>("nearby_branches", { p_lat: null, p_lng: null, p_radius_km: 25, p_query: null });
  return (
    <>
      <NearbyExplorer
        initial={data ?? []}
        tilesUrl={runtimeEnv("NEXT_PUBLIC_MAP_TILES_URL")}
        attribution={runtimeEnv("NEXT_PUBLIC_MAP_ATTRIBUTION")}
      />
      <ClientTabBar active="nearby" />
    </>
  );
}
