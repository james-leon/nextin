"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { adFileUrl, nextAd, type AdCandidate } from "@nextin/shared/ads";
import { trackAd } from "@/lib/client/ad-events";
import { SUPABASE_URL } from "@/lib/client/supabase-public";
import { useLiteT } from "@/lib/i18n/lite";

/** Temps d'affichage des files d'attente entre deux pubs. */
const QUEUE_MS = 20_000;

/**
 * Emplacement publicitaire de l'écran TV : les files d'attente (`children`) alternent avec un visuel tiré au sort
 * (poids de la base, jamais deux fois le même de suite), étiqueté « Publicité ». Les appels restent toujours visibles
 * dans la colonne de gauche. Sans visuel diffusable, seules les files s'affichent.
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
    <section aria-label={t("sponsored")} className="squircle relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.4vw] bg-tv-surface animate-pop-in">
      <div className="relative min-h-0 flex-1">
        {current.kind === "video" ? (
          <video key={current.creative_id} src={src} autoPlay muted playsInline onEnded={() => setCurrent(null)} className="absolute inset-0 size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- visuel du stockage public, déjà limité en poids
          <img key={current.creative_id} crossOrigin="anonymous" src={src} alt={current.headline} className="absolute inset-0 size-full object-cover" />
        )}
        <span className="absolute top-[1.6vh] left-[1.6vh] rounded-full bg-black/60 px-[1.2vh] py-[0.5vh] text-[1.8vh] font-semibold tracking-[0.06em] text-white uppercase">
          {t("sponsored")}
        </span>
      </div>
      <div className="px-[2.2vw] py-[2vh]">
        <p className="truncate text-[3vh] leading-tight font-bold">{current.headline}</p>
        <p className="truncate text-[2.3vh] text-white/80">{current.offer ? `${current.offer} · ${current.advertiser}` : current.advertiser}</p>
      </div>
    </section>
  );
}
