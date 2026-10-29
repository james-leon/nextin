"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { adFileUrl, canSkip, type AdCandidate } from "@nextin/shared/ads";
import { Button } from "@/components/ui/button";
import { trackAd } from "@/lib/client/ad-events";
import { SUPABASE_URL } from "@/lib/client/supabase-public";
import { useLiteT } from "@/lib/i18n/lite";

/**
 * Pub interstitielle entre deux niveaux (ou deux questions) : étiquette « Publicité », « Passer » après le délai de la
 * plateforme, fin automatique après la durée du visuel. Affichage, clic et « Passer » comptés (anonymes).
 */
export function Interstitial({ ad, token, skipAfter, onDone }: { ad: AdCandidate; token: string; skipAfter: number; onDone: () => void }) {
  const t = useLiteT("games");
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    trackAd(token, ad.creative_id, "game", "impression");
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(id);
  }, [ad.creative_id, token]);

  const skippable = canSkip(elapsed, skipAfter);
  const finished = elapsed >= Math.max(ad.duration, skipAfter) * 1000;

  useEffect(() => {
    if (finished && !done.current) {
      done.current = true;
      onDone();
    }
  }, [finished, onDone]);

  useEffect(() => {
    if (skippable) skipRef.current?.focus();
  }, [skippable]);

  function skip() {
    if (done.current) return;
    done.current = true;
    trackAd(token, ad.creative_id, "game", "skip");
    onDone();
  }

  const remaining = Math.max(1, Math.ceil(skipAfter - elapsed / 1000));
  return (
    <section aria-label={t("adLabel")} className="flex h-full flex-col gap-4 p-4">
      <p className="self-start rounded-full bg-grouped-secondary px-3 py-1 text-caption font-semibold uppercase text-label-secondary shadow-card">{t("adLabel")}</p>
      <div className="squircle flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
        <div className="relative min-h-0 flex-1 bg-fill-tertiary">
          {/* eslint-disable-next-line @next/next/no-img-element -- visuel du stockage public, déjà limité à 250 Ko */}
          <img crossOrigin="anonymous" src={adFileUrl(SUPABASE_URL, ad.path)} alt={ad.headline} className="absolute inset-0 size-full object-contain" decoding="async" />
        </div>
        <div className="flex flex-col gap-1 p-4">
          <p className="text-headline">{ad.headline}</p>
          {ad.offer ? <p className="text-subheadline text-label-secondary">{ad.offer}</p> : null}
          <p className="text-footnote text-label-secondary">{t("sponsoredBy", { advertiser: ad.advertiser })}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {ad.cta_url ? (
          <Button asChild variant="gray" className="flex-1">
            <a href={ad.cta_url} target="_blank" rel="noopener sponsored" onClick={() => trackAd(token, ad.creative_id, "game", "click")}>
              <ExternalLink aria-hidden className="size-4" />
              {t("learnMore")}
            </a>
          </Button>
        ) : null}
        <Button ref={skipRef} variant="tinted" className="flex-1" disabled={!skippable} onClick={skip}>
          {skippable ? t("skip") : t("skipIn", { seconds: remaining })}
        </Button>
      </div>
    </section>
  );
}
