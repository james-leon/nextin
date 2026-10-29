"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import type { AdCandidate } from "@nextin/shared/ads";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { Spinner } from "@/components/ui/spinner";
import type { GameSession, QuizResult, QuizStart } from "@/lib/client/games";
import { callRpc } from "@/lib/client/supabase-public";
import { cn } from "@/lib/cn";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { CouponCard } from "./coupon-card";
import { Interstitial } from "./interstitial";

/** Quiz sponsorisé : une question à la fois, une pub au milieu si elle est due, puis score et bon de réduction. */
export function QuizGame({
  token,
  quiz,
  skipAfter,
  nextInterstitial,
  couponBaseUrl,
}: {
  token: string;
  quiz: NonNullable<GameSession["quiz"]>;
  skipAfter: number;
  nextInterstitial: () => AdCandidate | null;
  couponBaseUrl: string;
}) {
  const t = useLiteT("games");
  const locale = useLiteLocale();
  const en = locale === "en";
  const [start, setStart] = useState<QuizStart | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [ad, setAd] = useState<AdCandidate | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [sending, setSending] = useState(false);

  async function finish(chosen: number[]) {
    setSending(true);
    const { data } = await callRpc<QuizResult>("finish_quiz", { p_ticket_token: token, p_play: start?.play_id, p_answers: chosen });
    setSending(false);
    if (data) setResult(data);
    else setFailed(true);
  }

  useEffect(() => {
    let alive = true;
    void callRpc<QuizStart>("start_quiz", { p_ticket_token: token, p_quiz: quiz.id }).then(async ({ data }) => {
      if (!alive) return;
      if (!data) return setFailed(true);
      setStart(data);
      // Partie déjà jouée sur ce ticket : on réaffiche le score et le bon.
      if (data.finished) {
        const r = await callRpc<QuizResult>("finish_quiz", { p_ticket_token: token, p_play: data.play_id, p_answers: [] });
        if (alive && r.data) setResult(r.data);
      }
    });
    return () => {
      alive = false;
    };
  }, [token, quiz.id]);

  if (failed) return <CalloutCard icon={<Circle />} role="alert">{t("unavailable")}</CalloutCard>;
  if (!start || (start.finished && !result)) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label={t("loading")} />
      </div>
    );
  }
  if (ad) return <Interstitial ad={ad} token={token} skipAfter={skipAfter} onDone={() => setAd(null)} />;

  if (result) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <section aria-live="polite" className="squircle flex flex-col items-center gap-2 rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-6 text-center shadow-card">
          <Trophy aria-hidden className="size-10 stroke-[1.5] text-orange" />
          <p className="text-title2 font-bold">{t("score", { score: result.score, total: result.total })}</p>
          <p className="text-subheadline text-label-secondary">{en && quiz.title_en ? quiz.title_en : quiz.title}</p>
        </section>
        {result.coupon ? (
          <CouponCard coupon={result.coupon} couponBaseUrl={couponBaseUrl} advertiser={quiz.advertiser} />
        ) : (
          <CalloutCard icon={<Circle />}>{t("noCoupon")}</CalloutCard>
        )}
      </div>
    );
  }

  const q = start.questions[index]!;
  const last = index === start.questions.length - 1;
  function next() {
    if (selected === null) return;
    const chosen = [...answers, selected];
    setAnswers(chosen);
    setSelected(null);
    if (last) return void finish(chosen);
    setIndex(index + 1);
    // Une seule pub au milieu du quiz, si l'espacement minimal le permet.
    if (index + 1 === Math.floor(start!.questions.length / 2)) setAd(nextInterstitial());
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <p className="px-4 text-footnote uppercase text-label-secondary">
        {t("questionOf", { n: index + 1, total: start.questions.length })} · {t("sponsoredBy", { advertiser: quiz.advertiser })}
      </p>
      <h2 className="px-4 text-title2 font-bold">{en && q.question_en ? q.question_en : q.question}</h2>
      <ul role="radiogroup" aria-label={en && q.question_en ? q.question_en : q.question} className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
        {q.answers.map((a, k) => (
          <li key={k} className="group/row pl-4">
            <button
              type="button"
              role="radio"
              aria-checked={selected === k}
              onClick={() => setSelected(k)}
              className={cn("pressable flex min-h-12 w-full items-center gap-3 py-2 pr-4 text-left text-body list-separator", selected === k && "font-semibold")}
            >
              {selected === k ? <CheckCircle2 aria-hidden className="size-6 shrink-0 text-accent-text" /> : <Circle aria-hidden className="size-6 shrink-0 text-label-tertiary" />}
              {en && a.text_en ? a.text_en : a.text}
            </button>
          </li>
        ))}
      </ul>
      <Button block onClick={next} disabled={selected === null} loading={sending} loadingLabel={t("loading")}>
        {last ? t("finish") : t("next")}
      </Button>
    </div>
  );
}
