"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { adFileUrl, nextAd, type AdCandidate } from "@nextin/shared/ads";
import { trackAd } from "@/lib/client/ad-events";
import { SUPABASE_URL } from "@/lib/client/supabase-public";
import { useLiteT } from "@/lib/i18n/lite";

/** Temps d'affichage du QR code de l'agence entre deux pubs. */
const QUEUE_MS = 20_000;

/**
 * Colonne publicitaire de l'écran TV (maquette v2 09) : le QR code de l'agence (`children`) alterne avec un visuel tiré
 * au sort (poids de la base, jamais deux fois le même de suite), étiqueté « Publicité ». Règles de diffusion inchangées
 * (M10b). Sans visuel diffusable (publicité désactivée pour l'écran), le QR code reste affiché : rien n'est laissé vide.
 */
export function TvAdSlot({ ads, adKey, children }: { ads: AdCandidate[]; adKey: string; children: ReactNode }) {
  const t = useLiteT("tv");
  const [current, setCurrent] = useState<AdCandidate | null>(null);
  const lastId = useRef<string | null>(null);
  const adsRef = useRef(ads);
  useEffect(() => {
    adsRef.current = ads;
  }, [ads]);

  useEffect(() => {
    if (current) {
      const id = setTimeout(() => setCurrent(null), current.duration * 1000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      const ad = nextAd(adsRef.current, lastId.current, Math.random());
      if (!ad) return;
      lastId.current = ad.creative_id;
      trackAd(adKey, ad.creative_id, "tv", "impression");
      setCurrent(ad);
    }, QUEUE_MS);
    return () => clearTimeout(id);
  }, [current, adKey]);

  if (!current) return <>{children}</>;
  const src = adFileUrl(SUPABASE_URL, current.path);
  return (
    <section aria-label={t("sponsored")} className="flex min-h-0 flex-1 flex-col overflow-hidden u-rounded-1_4 bg-grouped-secondary animate-pop-in">
      <div className="relative min-h-0 flex-1 bg-navy">
        {current.kind === "video" ? (
          <video key={current.creative_id} src={src} autoPlay muted playsInline onEnded={() => setCurrent(null)} className="absolute inset-0 size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- visuel du stockage public, déjà limité en poids
          <img key={current.creative_id} crossOrigin="anonymous" src={src} alt={current.headline} className="absolute inset-0 size-full object-cover" />
        )}
        <span className="absolute u-top-1_2 u-left-1_2 rounded-full bg-black/60 u-px-0_9 u-py-0_3 u-text-1 font-semibold text-white">
          {t("sponsored")}
        </span>
      </div>
      <div className="u-px-1_6 u-py-1_2">
        <p className="truncate u-text-2_3 leading-tight font-bold">{current.headline}</p>
        <p className="truncate u-text-1_3 text-label-secondary">{current.offer ? `${current.offer} · ${current.advertiser}` : current.advertiser}</p>
      </div>
    </section>
  );
}
