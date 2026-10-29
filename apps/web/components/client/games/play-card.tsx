"use client";

import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <section aria-labelledby="play-title" className="squircle flex items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card">
      <span aria-hidden className="squircle flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent-tint text-accent-on-tint">
        <Gamepad2 className="size-6 stroke-[1.75]" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="play-title" className="text-headline">
          {t("cardTitle")}
        </h2>
        <p className="text-subheadline text-label-secondary">{t("cardBody")}</p>
      </div>
      <Button variant="tinted" size="md" onClick={onOpen} aria-describedby="play-title">
        {t("open")}
      </Button>
    </section>
  );
}
