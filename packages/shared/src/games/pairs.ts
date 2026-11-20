/**
 * Paires (LOT 5b, maquette v2 11) : jeu de mémoire, logique pure sans DOM (testée). On retourne deux cartes à la fois ;
 * une paire trouvée reste visible ; deux cartes différentes se retournent après un court instant. Chrono (à partir de
 * la première carte), nombre de coups, étoiles selon les coups, record par niveau gardé sur l'appareil.
 */

/** Dessins des cartes : fruits et produits du marché (maquette v2 11). */
export const PAIR_FACES = ["mango", "pineapple", "plantain", "avocado", "coconut", "orange", "papaya", "corn", "pepper", "peanut"] as const;
export type PairFace = (typeof PAIR_FACES)[number];

/** Niveaux : nombre de paires. */
export const PAIR_LEVELS = [6, 8, 10] as const;
export type PairLevel = (typeof PAIR_LEVELS)[number];

/** Délai avant de retourner deux cartes différentes (ms). */
export const PAIRS_MISS_DELAY_MS = 1000;

export const pairsBestKey = (pairs: number) => `nextin.pairs.best.${pairs}`;

export type PairsState = {
  pairs: number;
  /** Dessin de chaque carte, dans l'ordre du plateau. */
  deck: PairFace[];
  matched: boolean[];
  /** Cartes retournées en attente (0, 1 ou 2). */
  open: number[];
  moves: number;
  startedAt: number | null;
  finishedAt: number | null;
};

/** Mélange de Fisher-Yates (`rand` dans [0, 1[). */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function newPairs(pairs: number, rand: () => number = Math.random): PairsState {
  const n = Math.min(Math.max(2, Math.floor(pairs)), PAIR_FACES.length);
  const faces = shuffle(PAIR_FACES, rand).slice(0, n);
  const deck = shuffle([...faces, ...faces], rand);
  return { pairs: n, deck, matched: deck.map(() => false), open: [], moves: 0, startedAt: null, finishedAt: null };
}

/** Deux cartes différentes sont visibles : le plateau attend `hideMiss` (aucune autre carte ne se retourne). */
export function isMiss(s: PairsState): boolean {
  return s.open.length === 2;
}

export function pairsFound(s: PairsState): number {
  return s.matched.filter(Boolean).length / 2;
}

export function isWon(s: PairsState): boolean {
  return s.finishedAt !== null;
}

/**
 * Retourne la carte `index` à l'instant `now` (ms). Sans effet si la partie est finie, si deux cartes différentes sont
 * encore visibles, ou si la carte est déjà visible. La deuxième carte compte un coup ; une paire reste visible.
 */
export function flip(s: PairsState, index: number, now: number): PairsState {
  if (isWon(s) || isMiss(s) || index < 0 || index >= s.deck.length || s.matched[index] || s.open.includes(index)) return s;
  const startedAt = s.startedAt ?? now;
  if (s.open.length === 0) return { ...s, open: [index], startedAt };
  const first = s.open[0]!;
  const moves = s.moves + 1;
  if (s.deck[first] !== s.deck[index]) return { ...s, open: [first, index], moves, startedAt };
  const matched = s.matched.map((m, i) => m || i === first || i === index);
  return { ...s, matched, open: [], moves, startedAt, finishedAt: matched.every(Boolean) ? now : null };
}

/** Retourne face cachée deux cartes différentes. */
export function hideMiss(s: PairsState): PairsState {
  return isMiss(s) ? { ...s, open: [] } : s;
}

/** Temps de jeu en secondes (figé à la fin de la partie). */
export function elapsedSeconds(s: PairsState, now: number): number {
  if (s.startedAt === null) return 0;
  return Math.max(0, Math.floor(((s.finishedAt ?? now) - s.startedAt) / 1000));
}

/** « 1:05 ». */
export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Étoiles selon les coups par paire : 3 jusqu'à 1,5, 2 jusqu'à 2,2, 1 au-delà. */
export function pairsStars(moves: number, pairs: number): 1 | 2 | 3 {
  const r = moves / Math.max(1, pairs);
  return r <= 1.5 ? 3 : r <= 2.2 ? 2 : 1;
}

/** Record d'un niveau : le moins de coups. */
export function isBetterPairs(moves: number, best: number | null): boolean {
  return moves > 0 && (best === null || moves < best);
}

/**
 * Grille sans défilement : nombre de colonnes qui donne les plus grandes cartes (rapport largeur / hauteur `ratio`)
 * dans la place disponible (`width` × `height`, écart `gap`). Renvoie colonnes, rangées et taille d'une carte.
 */
export function pairsGrid(cards: number, width: number, height: number, gap: number, ratio = 3 / 4): { cols: number; rows: number; cardWidth: number; cardHeight: number } {
  let best = { cols: 1, rows: cards, cardWidth: 0, cardHeight: 0 };
  for (let cols = 2; cols <= Math.min(cards, 6); cols++) {
    const rows = Math.ceil(cards / cols);
    const maxW = (width - gap * (cols - 1)) / cols;
    const maxH = (height - gap * (rows - 1)) / rows;
    const cardWidth = Math.max(0, Math.min(maxW, maxH * ratio));
    if (cardWidth > best.cardWidth) best = { cols, rows, cardWidth, cardHeight: cardWidth / ratio };
  }
  return { ...best, cardWidth: Math.floor(best.cardWidth), cardHeight: Math.floor(best.cardHeight) };
}
