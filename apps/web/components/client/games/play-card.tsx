"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Gamepad2 } from "lucide-react";
import type { GamesAvailable } from "@/lib/client/games";
import { callRpc } from "@/lib/client/supabase-public";
import { useLiteT } from "@/lib/i18n/lite";

/** Carte « Jouer en attendant » (légère) : affichée seulement si l'établissement propose un jeu. */
export function PlayCard({ token, onOpen }: { token: string; onOpen: () => void }) {
  const t = useLiteT("games");
  const [games, setGames] = useState<GamesAvailable>(null);
  useEffect(() => {
    let alive = true;
    void callRpc<GamesAvailable>("games_available", { p_ticket_token: token }).then(({ data }) => alive && setGames(data));
    return () => {
      alive = false;
    };
  }, [token]);
  if (!games || (!games.quiz && !games.sky_catch)) return null;
  return (
    <section aria-labelledby="play-title">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("open")}
        aria-describedby="play-title play-body"
        className="pressable squircle flex w-full items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 text-left shadow-card focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]"
      >
        <span aria-hidden className="squircle flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent-tint text-accent-on-tint">
          <Gamepad2 className="size-6 stroke-[1.75]" />
        </span>
        <span className="min-w-0 flex-1">
          <span id="play-title" className="block text-headline">
            {t("cardTitle")}
          </span>
          <span id="play-body" className="block text-subheadline text-label-secondary">
            {t("cardBody")}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-label-tertiary" />
      </button>
    </section>
  );
}
