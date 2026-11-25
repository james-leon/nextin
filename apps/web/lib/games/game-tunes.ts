/**
 * Partitions du quiz sans fin et des Paires (maquettes v2 10 et 11), fréquences exactes des maquettes ; jouées par
 * `components/client/games/game-sounds.ts` (Web Audio, aucun fichier).
 */
/** Note : fréquence (Hz), durée (s), forme, volume, départ (s), glissement vers (Hz). */
export type Note = { f: number; d: number; type: OscillatorType; v: number; at?: number; to?: number };
const note = (f: number, d: number, type: OscillatorType, v: number, at = 0, to?: number): Note => ({ f, d, type, v, at, to });

/** Partitions des maquettes. */
export const GAME_TUNES = {
  // Quiz (maquette v2 10).
  pick: [note(660, 0.06, "triangle", 0.25)],
  correct: [note(784, 0.12, "sine", 0.5), note(1047, 0.14, "sine", 0.5, 0.1), note(1568, 0.3, "sine", 0.4, 0.2)],
  wrong: [note(196, 0.32, "sawtooth", 0.28, 0, 110)],
  endGood: [523, 659, 784, 1047, 1319].map((f, i) => note(f, 0.24, "triangle", 0.4, i * 0.13)),
  endBad: [523, 494, 440].map((f, i) => note(f, 0.24, "triangle", 0.4, i * 0.13)),
  // Paires (maquette v2 11) : volumes de la maquette déjà multipliés par 2,2 (plafond 0,9), comme son `tone`.
  flip: [note(520, 0.06, "triangle", 0.264, 0, 780)],
  match: [note(784, 0.14, "sine", 0.55), note(1175, 0.22, "sine", 0.55, 0.1)],
  miss: [note(220, 0.18, "triangle", 0.396, 0, 160)],
  win: [...[523, 659, 784, 1047, 1319].map((f, i) => note(f, 0.22, "triangle", 0.484, i * 0.12)), note(1568, 0.6, "sine", 0.44, 0.62)],
} satisfies Record<string, Note[]>;

export type GameTune = keyof typeof GAME_TUNES;
