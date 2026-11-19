"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleHelp, RotateCcw } from "lucide-react";
import type { AdCandidate } from "@nextin/shared/ads";
import {
  QUIZ_BEST_KEY,
  QUIZ_DRAW_SIZE,
  QUIZ_LIVES,
  QUIZ_SEEN_KEY,
  answerSeries,
  interstitialAfter,
  isRecord,
  newSeries,
  parseSeen,
  rememberSeen,
  seriesOver,
  type QuizBankQuestion,
} from "@nextin/shared/games/quiz-bank";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { Spinner } from "@/components/ui/spinner";
import { callRpc } from "@/lib/client/supabase-public";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { Interstitial } from "./interstitial";
import { AnswerPill, Lives, QuizCard, ResultRing, type AnswerState } from "./quiz-ui";

/** Stockage de l'appareil : toujours protégé (navigation privée, stockage bloqué). */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Record ou questions vues non gardés : le jeu continue.
  }
}

/** Record du quiz sans fin sur l'appareil (null si aucun). */
export function readQuizBest(): number | null {
  const n = Number(read(QUIZ_BEST_KEY));
  return Number.isFinite(n) && n > 0 ? n : null;
}

type Check = { correct: boolean; answer: number };

/**
 * Quiz « série sans fin » (maquette v2 10) : questions de la banque Wintek tirées au hasard par la base, sans répétition
 * sur l'appareil ; 3 vies, score = bonnes réponses, record gardé sur l'appareil ; chaque réponse est vérifiée par la
 * base (la bonne réponse n'est jamais envoyée avant). Interstitielle existante toutes les N questions (espacement
 * minimal de la plateforme).
 */
export function QuizSeries({
  token,
  skipAfter,
  nextInterstitial,
}: {
  token: string;
  skipAfter: number;
  nextInterstitial: () => AdCandidate | null;
}) {
  const t = useLiteT("games");
  const en = useLiteLocale() === "en";
  const [series, setSeries] = useState(newSeries);
  const [question, setQuestion] = useState<QuizBankQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ad, setAd] = useState<AdCandidate | null>(null);
  const [over, setOver] = useState<{ score: number; best: number | null; record: boolean } | null>(null);
  const queue = useRef<QuizBankQuestion[]>([]);
  const ctaRef = useRef<HTMLButtonElement>(null);

  /** Tirage : questions jamais vues sur l'appareil ; tout vu, un nouveau tour commence. */
  const draw = useCallback(async (): Promise<boolean> => {
    const seen = parseSeen(read(QUIZ_SEEN_KEY));
    const exclude = [...seen, ...queue.current.map((q) => q.id)];
    let { data, error } = await callRpc<QuizBankQuestion[]>("quiz_bank_draw", { p_ticket_token: token, p_exclude: exclude, p_count: QUIZ_DRAW_SIZE });
    if (!error && data && data.length === 0 && seen.length) {
      write(QUIZ_SEEN_KEY, "[]");
      ({ data, error } = await callRpc<QuizBankQuestion[]>("quiz_bank_draw", {
        p_ticket_token: token,
        p_exclude: queue.current.map((q) => q.id),
        p_count: QUIZ_DRAW_SIZE,
      }));
    }
    if (error || !data) return false;
    queue.current.push(...data);
    return true;
  }, [token]);

  /** Question suivante de la réserve (vue dès qu'elle s'affiche), puis réserve complétée en arrière-plan. */
  const takeNext = useCallback(() => {
    const next = queue.current.shift();
    if (!next) return setFailed(true);
    write(QUIZ_SEEN_KEY, JSON.stringify(rememberSeen(parseSeen(read(QUIZ_SEEN_KEY)), [next.id])));
    setSelected(null);
    setCheck(null);
    setQuestion(next);
    if (queue.current.length < 2) void draw();
  }, [draw]);

  const showNext = useCallback(async () => {
    if (queue.current.length === 0 && !(await draw())) return setFailed(true);
    takeNext();
  }, [draw, takeNext]);

  useEffect(() => {
    let alive = true;
    void draw().then((ok) => {
      if (!alive) return;
      if (ok) takeNext();
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [draw, takeNext]);

  async function validate() {
    if (selected === null || !question) return;
    setSending(true);
    const { data } = await callRpc<Check>("quiz_bank_check", { p_ticket_token: token, p_question: question.id, p_answer: selected });
    setSending(false);
    if (!data) return setFailed(true);
    setCheck(data);
    setSeries((s) => answerSeries(s, data.correct));
    if (!data.correct) {
      try {
        navigator.vibrate?.(60);
      } catch {
        // Vibration indisponible.
      }
    }
    ctaRef.current?.focus();
  }

  function proceed() {
    if (seriesOver(series)) {
      const best = readQuizBest();
      const record = isRecord(series.score, best);
      if (record) write(QUIZ_BEST_KEY, String(series.score));
      setOver({ score: series.score, best: record ? series.score : best, record });
      return;
    }
    if (interstitialAfter(series.asked)) {
      const due = nextInterstitial();
      if (due) return setAd(due);
    }
    void showNext();
  }

  function restart() {
    setSeries(newSeries());
    setOver(null);
    void showNext();
  }

  if (ad)
    return (
      <Interstitial
        ad={ad}
        token={token}
        skipAfter={skipAfter}
        onDone={() => {
          setAd(null);
          void showNext();
        }}
      />
    );

  if (failed) {
    return (
      <CalloutCard icon={<CircleHelp />} className="m-4" role="alert">
        {t("unavailable")}
      </CalloutCard>
    );
  }

  if (over) {
    const title = over.score >= 8 ? t("resultExcellent") : over.score >= 4 ? t("resultGood") : t("resultKeepGoing");
    return (
      <section aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-3.5 p-6 text-center">
        <p className="text-caption font-bold tracking-[0.14em] text-orange-text uppercase">{t("resultEyebrow")}</p>
        <ResultRing value={over.score} fraction={over.best ? over.score / over.best : 0} label={t("goodAnswersLabel", { count: over.score })} />
        <h2 className="font-rounded text-title1 font-extrabold">{title}</h2>
        <p className="max-w-[30ch] text-subheadline text-label-secondary">
          {over.record ? t("newRecord") : t("yourRecord", { count: over.best ?? 0 })}
        </p>
        <Button className="h-16 w-full max-w-[300px] rounded-[22px] font-rounded text-title3 font-extrabold" trailingIcon={<RotateCcw />} onClick={restart}>
          {t("playAgain")}
        </Button>
      </section>
    );
  }

  if (!question) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spinner label={t("loading")} />
      </div>
    );
  }

  const text = (a: { text: string; text_en: string | null }) => (en && a.text_en ? a.text_en : a.text);
  const state = (k: number): AnswerState =>
    check ? (k === check.answer ? "correct" : k === selected ? "wrong" : "dim") : selected === k ? "selected" : "idle";
  const finished = check !== null && seriesOver(series);

  return (
    <div className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <span className="font-rounded text-subheadline font-bold tabular">{t("goodAnswers", { count: series.score })}</span>
        <Lives lives={series.lives} total={QUIZ_LIVES} />
      </div>
      <QuizCard
        number={series.asked + (check ? 0 : 1)}
        verdict={check ? (check.correct ? "correct" : "wrong") : null}
        category={question.category}
        question={en && question.question_en ? question.question_en : question.question}
      >
        {question.answers.map((a, k) => (
          <AnswerPill key={`${question.id}-${k}`} index={k} text={text(a)} state={state(k)} disabled={check !== null || sending} onSelect={() => setSelected(k)} />
        ))}
      </QuizCard>
      <Button
        ref={ctaRef}
        block
        className="h-16 rounded-[22px] font-rounded text-title3 font-extrabold"
        disabled={!check && selected === null}
        loading={sending}
        loadingLabel={t("loading")}
        trailingIcon={check ? <ArrowRight /> : <Check />}
        onClick={check ? proceed : validate}
      >
        {check ? (finished ? t("seeResult") : t("nextQuestion")) : t("validate")}
      </Button>
    </div>
  );
}
