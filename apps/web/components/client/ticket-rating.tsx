"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { callRpc } from "@/lib/client/supabase-public";
import type { TicketView } from "@/lib/client/types";

/** Note de 1 à 5 après le passage (une seule fois), commentaire facultatif. */
export function TicketRating({ token, onRated }: { token: string; onRated: (view: TicketView) => void }) {
  const t = useTranslations("client.ticket");
  const te = useTranslations("errors");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setPending(true);
    setError(null);
    const { data, error: e } = await callRpc<TicketView>("rate_ticket", { p_token: token, p_rating: rating, p_comment: comment.trim() || null });
    setPending(false);
    if (data) return onRated(data);
    setError(te.has(e.message as never) ? te(e.message as never) : te(e.status === 0 ? "network" : "generic"));
  }

  return (
    <section aria-labelledby="rate-title" className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5">
      <h2 id="rate-title" className="text-headline">
        {t("rateTitle")}
      </h2>
      <div role="radiogroup" aria-label={t("rateLabel")} className="flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("star", { count: n })}
            onClick={() => setRating(n)}
            className="pressable flex size-12 items-center justify-center rounded-full"
          >
            <Star
              aria-hidden
              className={cn("size-9 stroke-[1.5] transition-colors", n <= rating ? "fill-orange text-orange" : "text-label-tertiary")}
            />
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-footnote uppercase text-label-secondary">{t("comment")}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          className="squircle w-full resize-none rounded-[var(--radius-md)] bg-grouped px-4 py-3 text-body text-label outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]"
        />
      </label>
      <BottomBar
        summary={
          error ? (
            <span role="alert" className="text-red-text">
              {error}
            </span>
          ) : undefined
        }
      >
        <Button block onClick={send} loading={pending} disabled={rating === 0}>
          {t("send")}
        </Button>
      </BottomBar>
    </section>
  );
}
