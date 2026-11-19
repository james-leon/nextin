"use client";

import { useEffect, useState } from "react";
import { Circle, Gift } from "lucide-react";
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
import { AnswerPill, QuizCard, ResultRing } from "./quiz-ui";

/**
 * Quiz sponsorisé (M10b, style de la maquette v2 10) : une question à la fois, une pub au milieu si elle est due, puis
 * score et bon de réduction. Logique inchangée : réponses envoyées et vérifiées par la base à la fin (`finish_quiz`).
 */
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

  const title = en && quiz.title_en ? quiz.title_en : quiz.title;
  const reward = en && quiz.reward_en ? quiz.reward_en : quiz.reward;
  const sponsor = (
    <p className="flex items-center gap-2.5 rounded-[14px] bg-grouped-secondary px-3 py-2.5 text-footnote">
      <Gift aria-hidden className="size-7 shrink-0 stroke-[1.8] text-orange-text" />
      <span className="min-w-0">
        <span className="block text-caption tracking-[0.08em] text-label-secondary uppercase">{t("sponsoredBy", { advertiser: quiz.advertiser })}</span>
        {title} · {reward}
      </span>
    </p>
  );

  if (result) {
    return (
      <div className="flex flex-col items-center gap-4 p-4 text-center">
        <section aria-live="polite" className="flex flex-col items-center gap-3">
          <p className="text-caption font-bold tracking-[0.14em] text-orange-text uppercase">{t("resultEyebrow")}</p>
          <ResultRing value={result.score} fraction={result.total ? result.score / result.total : 0} label={t("score", { score: result.score, total: result.total })} />
          <h2 className="font-rounded text-title1 font-extrabold">{title}</h2>
        </section>
        {result.coupon ? (
          <CouponCard coupon={result.coupon} couponBaseUrl={couponBaseUrl} advertiser={quiz.advertiser} />
        ) : (
          <CalloutCard icon={<Circle />} className="w-full text-left">
            {t("noCoupon")}
          </CalloutCard>
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
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <span className="font-rounded text-subheadline font-bold tabular">{t("questionOf", { n: index + 1, total: start.questions.length })}</span>
        <span aria-hidden className="flex flex-1 gap-1.5">
          {start.questions.map((_, k) => (
            <i key={k} className={cn("h-1.5 flex-1 rounded-full", k < index ? "bg-accent" : k === index ? "bg-orange" : "bg-fill")} />
          ))}
        </span>
      </div>
      <QuizCard number={index + 1} verdict={null} question={en && q.question_en ? q.question_en : q.question}>
        {q.answers.map((a, k) => (
          <AnswerPill key={k} index={k} text={en && a.text_en ? a.text_en : a.text} state={selected === k ? "selected" : "idle"} disabled={sending} onSelect={() => setSelected(k)} />
        ))}
      </QuizCard>
      <Button block className="h-16 rounded-[22px] font-rounded text-title3 font-extrabold" onClick={next} disabled={selected === null} loading={sending} loadingLabel={t("loading")}>
        {last ? t("finish") : t("next")}
      </Button>
      {sponsor}
    </div>
  );
}
