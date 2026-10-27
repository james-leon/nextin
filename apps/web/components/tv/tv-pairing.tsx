"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { useLiteT } from "@/lib/i18n/lite";

type Pending = { displayId: string; code: string; pollSecret: string; expiresAt: string };

const POLL_MS = 3_000;

/** Écran non appairé : affiche un code à 6 chiffres, le renouvelle à expiration, attend l'appairage. */
export function TvPairing({ onPaired }: { onPaired: (deviceToken: string) => void }) {
  const t = useLiteT("tv");
  const [pending, setPending] = useState<Pending | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: Pending | null = null;

    const request = async () => {
      try {
        const res = await fetch("/api/tv/pair", { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        current = (await res.json()) as Pending;
        if (alive) {
          setPending(current);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
        current = null;
      }
    };
    const poll = async () => {
      if (!alive) return;
      if (!current || new Date(current.expiresAt).getTime() < Date.now()) await request();
      else {
        try {
          const res = await fetch("/api/tv/pair/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayId: current.displayId, pollSecret: current.pollSecret }),
          });
          const body = (await res.json()) as { status: string; deviceToken: string | null };
          if (body.status === "active" && body.deviceToken) return onPaired(body.deviceToken);
          if (body.status === "expired" || body.status === "unknown") current = null;
        } catch {
          // Réseau indisponible : on réessaie au prochain tour.
        }
      }
      if (alive) timer = setTimeout(poll, current ? POLL_MS : 10_000);
    };
    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [onPaired]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-tv px-12 text-center text-white">
      <Logo tone="inverse" className="[&>span:first-child]:size-14 [&>span:last-child]:text-title1" />
      <h1 className="text-[clamp(2rem,4vw,3.5rem)] leading-tight font-bold">{t("pairTitle")}</h1>
      <p
        aria-live="polite"
        className="squircle rounded-[var(--radius-xl)] bg-white px-14 py-8 text-[clamp(4rem,12vw,9rem)] leading-none font-extrabold tracking-[0.15em] text-ticket-number tabular"
      >
        {pending ? `${pending.code.slice(0, 3)} ${pending.code.slice(3)}` : "··· ···"}
      </p>
      <p className="max-w-3xl text-[clamp(1.25rem,2.2vw,2rem)] leading-snug text-white/85">{t("pairBody")}</p>
      <p className="text-[clamp(1rem,1.6vw,1.4rem)] leading-snug text-white/75">{failed ? t("offline") : t("expires")}</p>
    </main>
  );
}
