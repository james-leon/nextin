"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/logo";
import { useLiteT } from "@/lib/i18n/lite";
import { TV_UNIT_STYLE } from "./tv-board";

type Pending = { displayId: string; code: string; pollSecret: string; expiresAt: string; receivedAt: number };

const POLL_MS = 3_000;

/**
 * Écran non appairé (maquette v2 23) : code à 6 chiffres en très grand, en deux groupes de trois pour le lire à voix haute,
 * barre du temps restant avant le prochain code. Après une révocation, message en rouge au-dessus.
 */
export function TvPairing({ onPaired, revoked = false }: { onPaired: (deviceToken: string) => void; revoked?: boolean }) {
  const t = useLiteT("tv");
  const [pending, setPending] = useState<Pending | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Rendu seulement dans le navigateur (l'écran attend le jeton d'appareil) : adresse lue directement.
  const [host] = useState(() => (typeof window === "undefined" ? "" : window.location.host));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: Pending | null = null;

    const request = async () => {
      try {
        const res = await fetch("/api/tv/pair", { method: "POST" });
        if (!res.ok) throw new Error(String(res.status));
        current = { ...((await res.json()) as Omit<Pending, "receivedAt">), receivedAt: Date.now() };
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

  const digits = pending ? pending.code.split("") : ["·", "·", "·", "·", "·", "·"];
  const total = pending ? new Date(pending.expiresAt).getTime() - pending.receivedAt : 0;
  const remaining = pending && total > 0 ? Math.min(1, Math.max(0, (new Date(pending.expiresAt).getTime() - now) / total)) : 0;
  const box = (d: string, i: number) => (
    <span
      key={i}
      className="grid u-h-10 u-w-8 place-items-center u-rounded-1_4 bg-grouped-secondary font-rounded u-text-6 font-bold text-ticket-number u-ring-0_15"
    >
      {d}
    </span>
  );

  return (
    <main
      style={TV_UNIT_STYLE}
      className="flex min-h-dvh flex-col items-center justify-center u-gap-1_6 bg-grouped u-px-4 text-center leading-snug text-label"
    >
      {revoked ? (
        <p role="alert" className="rounded-full bg-red-tint u-px-1_8 u-py-0_6 u-text-1_6 font-semibold text-red-on-tint">
          {t("revoked")}
        </p>
      ) : null}
      <LogoMark className="u-size-7" />
      <h1 className="u-text-3_6 font-bold tracking-[-0.02em] text-balance">{t("pairTitle")}</h1>
      {revoked ? null : <p className="u-max-w-60 u-text-1_7 text-balance text-label-secondary">{t("pairBody")}</p>}
      <p aria-live="polite" data-pairing-code={pending?.code ?? ""} className="flex u-gap-1_2">
        <span className="sr-only">{pending ? `${pending.code.slice(0, 3)} ${pending.code.slice(3)}` : ""}</span>
        <span aria-hidden className="flex u-gap-1_2">
          {digits.slice(0, 3).map(box)}
          <i className="u-w-2" />
          {digits.slice(3).map((d, i) => box(d, i + 3))}
        </span>
      </p>
      <span aria-hidden className="u-h-0_5 u-w-30 overflow-hidden rounded-full bg-separator">
        <span className="block h-full bg-accent transition-[width] duration-1000 ease-linear motion-reduce:transition-none" style={{ width: `${remaining * 100}%` }} />
      </span>
      <p className="u-text-1_4 text-label-secondary">
        {failed ? t("offline") : t("expires")}
        {host ? ` · ${host}/tv` : ""}
      </p>
    </main>
  );
}
