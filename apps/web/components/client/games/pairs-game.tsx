"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw, Star } from "lucide-react";
import {
  PAIR_LEVELS,
  PAIRS_MISS_DELAY_MS,
  elapsedSeconds,
  flip,
  formatClock,
  hideMiss,
  isBetterPairs,
  isMiss,
  isWon,
  newPairs,
  pairsBestKey,
  pairsFound,
  pairsGrid,
  pairsStars,
  type PairLevel,
  type PairsState,
} from "@nextin/shared/games/pairs";
import { Button, IconButton } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PAIR_ART } from "@/lib/games/pair-art";
import { cn } from "@/lib/cn";
import { useLiteT } from "@/lib/i18n/lite";

const GAP = 8;
const LEVEL_KEYS = ["levelEasy", "levelMedium", "levelHard"] as const;

/** Record d'un niveau (le moins de coups) gardé sur l'appareil ; null si aucun ou stockage indisponible. */
export function readPairsBest(pairs: number): number | null {
  try {
    const n = Number(localStorage.getItem(pairsBestKey(pairs)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writePairsBest(pairs: number, moves: number) {
  try {
    localStorage.setItem(pairsBestKey(pairs), String(moves));
  } catch {
    // Record non gardé (stockage indisponible).
  }
}

/** Dos des cartes : le N du logo en blanc sur bleu nuit. */
function CardBack() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[38%]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18V6l12 12V6" />
    </svg>
  );
}

/**
 * Paires (maquette v2 11) : jeu de mémoire calme, sans lecture. Trois niveaux (6, 8 ou 10 paires), plateau à la
 * hauteur de l'écran (aucun défilement), chrono et coups, étoiles, record par niveau sur l'appareil. Retournement
 * léger (aucune animation si elles sont réduites). Figé pendant l'appel (`frozen`) : chrono arrêté, cartes bloquées.
 */
export function PairsGame({ frozen }: { frozen: boolean }) {
  const t = useLiteT("games");
  const [level, setLevel] = useState<PairLevel>(PAIR_LEVELS[0]);
  const [game, setGame] = useState<PairsState>(() => newPairs(PAIR_LEVELS[0]));
  // Horloge de la page (`performance.now()`, même origine que `event.timeStamp`).
  const [now, setNow] = useState(() => performance.now());
  const [best, setBest] = useState<number | null>(() => readPairsBest(PAIR_LEVELS[0]));
  const [result, setResult] = useState<{ record: boolean } | null>(null);
  const [grid, setGrid] = useState<ReturnType<typeof pairsGrid> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Plateau à la taille de la place disponible : la plus grande carte possible, sans défilement.
  const cards = game.deck.length;
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    // Le premier rappel arrive dès l'observation : mesure initiale comprise.
    const ro = new ResizeObserver(() => setGrid(pairsGrid(cards, el.clientWidth, el.clientHeight, GAP)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [cards]);

  // Chrono : à partir de la première carte, arrêté à la fin et pendant l'appel.
  const running = game.startedAt !== null && !isWon(game) && !frozen;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // Deux cartes différentes : retournées après un court instant.
  useEffect(() => {
    if (!isMiss(game)) return;
    const id = setTimeout(() => setGame(hideMiss), PAIRS_MISS_DELAY_MS);
    return () => clearTimeout(id);
  }, [game]);

  function start(pairs: PairLevel) {
    setLevel(pairs);
    setGame(newPairs(pairs));
    setBest(readPairsBest(pairs));
    setResult(null);
  }

  function onFlip(index: number, at: number) {
    if (frozen) return;
    const next = flip(game, index, at);
    if (next === game) return;
    setGame(next);
    setNow(at);
    if (isWon(next)) {
      const previous = readPairsBest(next.pairs);
      const record = isBetterPairs(next.moves, previous);
      if (record) writePairsBest(next.pairs, next.moves);
      setBest(record ? next.moves : previous);
      setResult({ record });
    }
  }

  const seconds = elapsedSeconds(game, now);
  const stars = pairsStars(game.moves, game.pairs);
  const levelIndex = PAIR_LEVELS.indexOf(level);
  const nextLevel = PAIR_LEVELS[levelIndex + 1];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-caption font-bold tracking-[0.12em] text-label-secondary uppercase">{t("pairsEyebrow")}</p>
          <h2 className="font-rounded text-title2 font-extrabold">{t("pairsTitle")}</h2>
        </div>
        <IconButton label={t("restart")} icon={<RotateCcw />} variant="gray" onClick={() => start(level)} />
      </div>
      <div className="px-4 py-1">
        <SegmentedControl
          label={t("difficulty")}
          value={String(level)}
          onValueChange={(v) => start(Number(v) as PairLevel)}
          options={PAIR_LEVELS.map((p, i) => ({ value: String(p), label: t(LEVEL_KEYS[i]!, { pairs: p }) }))}
        />
      </div>
      <dl className="grid grid-cols-3 gap-2 px-4 py-1.5">
        {[
          [t("statPairs"), `${pairsFound(game)}/${game.pairs}`],
          [t("statMoves"), String(game.moves)],
          [t("statTime"), formatClock(seconds)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col rounded-[14px] bg-grouped-secondary px-2.5 py-2">
            <dt className="text-caption text-label-secondary">{label}</dt>
            <dd className="font-rounded text-headline font-bold tabular">{value}</dd>
          </div>
        ))}
      </dl>
      <div ref={boardRef} role="group" aria-label={t("board")} className="flex min-h-0 flex-1 items-center justify-center px-4 py-2.5">
        {grid ? (
          <div className="grid" style={{ gap: GAP, gridTemplateColumns: `repeat(${grid.cols}, ${grid.cardWidth}px)` }}>
            {game.deck.map((face, i) => {
              const up = game.open.includes(i);
              const done = game.matched[i];
              const miss = up && isMiss(game);
              const name = t(`faces.${face}`);
              return (
                <button
                  key={`${game.deck.length}-${i}`}
                  type="button"
                  aria-label={done ? t("foundCard", { name }) : up ? name : t("hiddenCard", { n: i + 1 })}
                  aria-disabled={done || up || frozen || undefined}
                  onClick={(e) => onFlip(i, e.timeStamp)}
                  className="relative rounded-[14px] [perspective:600px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent"
                  style={{ width: grid.cardWidth, height: grid.cardHeight }}
                >
                  <span
                    className={cn(
                      "absolute inset-0 transition-transform duration-[380ms] ease-[var(--ease-spring)] [transform-style:preserve-3d] motion-reduce:transition-none",
                      (up || done) && "[transform:rotateY(180deg)]",
                    )}
                  >
                    <span className="absolute inset-0 grid place-items-center rounded-[14px] bg-navy text-white [backface-visibility:hidden]">
                      <span aria-hidden className="absolute inset-1.5 rounded-[10px] border-[1.5px] border-dashed border-white/20" />
                      <CardBack />
                    </span>
                    <span
                      className={cn(
                        "absolute inset-0 grid place-items-center rounded-[14px] border-[1.5px] bg-white [backface-visibility:hidden] [transform:rotateY(180deg)]",
                        done ? "border-green ring-[3px] ring-green/25" : miss ? "border-red" : "border-separator",
                      )}
                    >
                      <span aria-hidden className="grid aspect-square w-[76%] place-items-center rounded-full" style={{ background: PAIR_ART[face].disc }}>
                        <svg viewBox="0 0 24 24" className="size-[78%]" dangerouslySetInnerHTML={{ __html: PAIR_ART[face].svg }} />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {result ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="pairs-win"
          className="material-blur absolute inset-0 z-10 flex flex-col items-center justify-center gap-3.5 bg-grouped/90 p-6 text-center animate-fade-in"
        >
          <p className="text-caption font-bold tracking-[0.12em] text-green-text uppercase">{t("winEyebrow")}</p>
          <h2 id="pairs-win" className="font-rounded text-title1 font-extrabold">
            {t("winTitle")}
          </h2>
          <p role="img" aria-label={t("stars", { count: stars })} className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                aria-hidden
                className={cn("size-10 stroke-[1.5]", n <= stars ? "fill-[var(--game-coin)] text-[var(--game-coin-edge)]" : "fill-none text-label-tertiary")}
              />
            ))}
          </p>
          <dl className="grid w-full max-w-[300px] grid-cols-3 gap-2">
            {[
              [t("statMoves"), String(game.moves)],
              [t("statTime"), formatClock(seconds)],
              [t("statRecord"), best ? t("moves", { count: best }) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[12px] bg-grouped-secondary p-2">
                <dt className="text-caption text-label-secondary">{label}</dt>
                <dd className="font-rounded text-headline font-bold tabular">{value}</dd>
              </div>
            ))}
          </dl>
          {result.record ? <p className="text-subheadline font-semibold text-green-text">{t("newRecord")}</p> : null}
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button autoFocus onClick={() => start(level)}>
              {t("playAgain")}
            </Button>
            {nextLevel ? (
              <Button variant="gray" onClick={() => start(nextLevel)}>
                {t("nextLevel")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
