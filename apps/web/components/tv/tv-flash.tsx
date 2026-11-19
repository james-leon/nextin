"use client";

import { useEffect, useState } from "react";
import type { BoardCall } from "@nextin/shared/queue/live";
import { useLiteT } from "@/lib/i18n/lite";
import { TV_UNIT_STYLE } from "./tv-board";

/** Durée du flash d'appel (maquette v2 09). */
export const TV_FLASH_MS = 4_000;

/**
 * Flash d'appel vert plein écran (maquette v2 09) : « Ticket appelé », numéro géant, « Allez au cabinet 2 », service, et
 * une barre qui indique le temps restant. Affiché pendant `TV_FLASH_MS`, en même temps que le carillon et l'annonce.
 * Décoratif pour les lecteurs d'écran : la liste des appels (région « assertive ») porte déjà l'information.
 */
export function TvFlash({ call, service }: { call: BoardCall; service: string }) {
  const t = useLiteT("tv");
  const tc = useLiteT("client.ticket");
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const goTo = call.counter_label ? tc("goToLabel", { counter: call.counter_label }) : tc(`goTo.${call.counter_kind}`, { number: call.counter_number });

  return (
    <div
      aria-hidden
      data-testid="tv-flash"
      style={TV_UNIT_STYLE}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-[calc(var(--u)*0.8)] bg-called text-center leading-snug text-white"
    >
      <p className="text-[calc(var(--u)*2.6)] font-semibold opacity-90">{t("called")}</p>
      <p className="font-rounded text-[calc(var(--u)*17)] leading-[0.95] font-bold tracking-[-0.02em] whitespace-nowrap">{call.code}</p>
      <p className="text-[calc(var(--u)*4.6)] font-bold">{goTo}</p>
      {service ? <p className="text-[calc(var(--u)*2)] opacity-85">{service}</p> : null}
      <span className="mt-[calc(var(--u)*2)] h-[calc(var(--u)*0.6)] w-[calc(var(--u)*30)] overflow-hidden rounded-full bg-white/30">
        <span
          className="block h-full rounded-full bg-white transition-[width] ease-linear motion-reduce:transition-none"
          style={{ width: started ? "0%" : "100%", transitionDuration: `${TV_FLASH_MS}ms` }}
        />
      </span>
    </div>
  );
}
