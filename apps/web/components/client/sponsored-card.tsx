"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { adFileUrl, type AdCandidate } from "@nextin/shared/ads";
import { trackAd } from "@/lib/client/ad-events";
import { callRpc, SUPABASE_URL } from "@/lib/client/supabase-public";
import { useLiteT } from "@/lib/i18n/lite";

/**
 * Pub de l'application sous « Mon ticket » (chargée à la demande) : un visuel tiré au sort par la base pour l'agence,
 * étiqueté « Sponsorisé ». Affichage compté quand la carte devient visible, image chargée paresseusement.
 */
export function SponsoredCard({ token }: { token: string }) {
  const t = useLiteT("games");
  const [ad, setAd] = useState<AdCandidate | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    void callRpc<AdCandidate | null>("app_ad", { p_ticket_token: token }).then(({ data }) => alive && setAd(data));
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    const el = ref.current;
    if (!ad || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackAd(token, ad.creative_id, "app", "impression");
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad, token]);

  if (!ad) return null;
  const body = (
    <>
      <div className="relative aspect-video bg-fill-tertiary">
        {/* eslint-disable-next-line @next/next/no-img-element -- visuel du stockage public (250 Ko au plus), chargé à la demande */}
        <img crossOrigin="anonymous" src={adFileUrl(SUPABASE_URL, ad.path)} alt={ad.headline} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      </div>
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase text-label-secondary">{t("sponsored")} · {ad.advertiser}</p>
          <p className="text-headline">{ad.headline}</p>
          {ad.offer ? <p className="text-subheadline text-label-secondary">{ad.offer}</p> : null}
        </div>
        {ad.cta_url ? <ExternalLink aria-hidden className="mt-1 size-5 shrink-0 text-label-tertiary" /> : null}
      </div>
    </>
  );
  const cls = "squircle block overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card";
  return (
    <aside ref={ref} aria-label={t("sponsored")}>
      {ad.cta_url ? (
        <a href={ad.cta_url} target="_blank" rel="noopener sponsored" className={`pressable ${cls}`} onClick={() => trackAd(token, ad.creative_id, "app", "click")}>
          {body}
        </a>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </aside>
  );
}
