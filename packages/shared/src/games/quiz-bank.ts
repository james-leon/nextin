/**
 * Quiz « série sans fin » (LOT 5b, maquette v2 10) : logique pure, sans DOM (testée).
 * - Banque de questions Wintek : lecture du fichier d'import CSV (`pnpm quiz:import`) ;
 * - partie : 3 vies, score = bonnes réponses, record gardé sur l'appareil ;
 * - questions déjà vues mémorisées sur l'appareil (aucune répétition avant d'avoir tout vu).
 */

/** Vies au départ ; chaque erreur en coûte une. */
export const QUIZ_LIVES = 3;
/** Interstitielle publicitaire proposée toutes les N questions (l'espacement minimal de la plateforme s'applique). */
export const QUIZ_INTERSTITIAL_EVERY = 5;
/** Questions demandées à la base à chaque tirage. */
export const QUIZ_DRAW_SIZE = 5;
/** Questions vues gardées sur l'appareil (au-delà, les plus anciennes peuvent revenir). */
export const QUIZ_SEEN_MAX = 1000;
/** Clés du stockage de l'appareil. */
export const QUIZ_BEST_KEY = "nextin.quiz.best";
export const QUIZ_SEEN_KEY = "nextin.quiz.seen";

export type QuizBankAnswer = { text: string; text_en: string | null };
/** Question telle que la base l'envoie : jamais la bonne réponse. */
export type QuizBankQuestion = {
  id: string;
  category: string;
  difficulty: number;
  question: string;
  question_en: string | null;
  answers: QuizBankAnswer[];
};

export type SeriesState = { asked: number; score: number; lives: number };

export function newSeries(): SeriesState {
  return { asked: 0, score: 0, lives: QUIZ_LIVES };
}

/** Réponse vérifiée par la base : +1 au score si juste, une vie de moins sinon. */
export function answerSeries(s: SeriesState, correct: boolean): SeriesState {
  return { asked: s.asked + 1, score: s.score + (correct ? 1 : 0), lives: correct ? s.lives : Math.max(0, s.lives - 1) };
}

export function seriesOver(s: SeriesState): boolean {
  return s.lives <= 0;
}

/** Après `asked` questions : une interstitielle est-elle proposée (toutes les N, jamais en fin de partie) ? */
export function interstitialAfter(asked: number, every = QUIZ_INTERSTITIAL_EVERY): boolean {
  return asked > 0 && every > 0 && asked % every === 0;
}

/** Nouveau record ? */
export function isRecord(score: number, best: number | null): boolean {
  return score > 0 && score > (best ?? 0);
}

/** Questions vues : ajoute les nouvelles à la fin, sans doublon, en gardant les `max` plus récentes. */
export function rememberSeen(seen: readonly string[], ids: readonly string[], max = QUIZ_SEEN_MAX): string[] {
  const set = new Set(ids);
  const kept = seen.filter((id) => !set.has(id));
  return [...kept, ...ids].slice(-max);
}

/** Lecture tolérante d'une liste d'identifiants gardée sur l'appareil. */
export function parseSeen(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(-QUIZ_SEEN_MAX) : [];
  } catch {
    return [];
  }
}

// ─── Import CSV ────────────────────────────────────────────────────────────────

export const QUIZ_CSV_HEADER = [
  "id",
  "categorie",
  "difficulte",
  "question_fr",
  "question_en",
  "reponse1_fr",
  "reponse1_en",
  "reponse2_fr",
  "reponse2_en",
  "reponse3_fr",
  "reponse3_en",
  "reponse4_fr",
  "reponse4_en",
  "bonne_reponse",
] as const;

/** Ligne prête pour la table `quiz_bank_questions` (`correct` : index 0 à 3). */
export type QuizBankRow = {
  id: string;
  category: string;
  difficulty: 1 | 2 | 3;
  question: string;
  question_en: string | null;
  answers: QuizBankAnswer[];
  correct: number;
};

export type QuizCsvError = { line: number; message: string };

/** Découpe un CSV (séparateur `;`, guillemets doubles, `""` pour un guillemet, fins de ligne CRLF ou LF, BOM ignoré). */
export function splitCsv(text: string, separator = ";"): { line: number; cells: string[] }[] {
  const src = text.replace(/^﻿/, "");
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else {
        if (c === "\n") line++;
        cell += c;
      }
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === separator) {
      cells.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      cells.push(cell);
      rows.push({ line: start, cells });
      cells = [];
      cell = "";
      line++;
      start = line;
    } else cell += c;
  }
  if (cell !== "" || cells.length) {
    cells.push(cell);
    rows.push({ line: start, cells });
  }
  return rows.filter((r) => r.cells.some((c) => c.trim() !== ""));
}

const LIMITS = { id: 40, category: 40, question: 300, answer: 160 } as const;

/**
 * Lecture du fichier d'import de la banque (UTF-8, `;`, en-tête exact `QUIZ_CSV_HEADER`) : difficulté 1, 2 ou 3 ;
 * bonne réponse 1 à 4 ; réponses 3 et 4 facultatives (mais la 4 sans la 3 est refusée) ; identifiants uniques.
 * Toutes les erreurs sont rendues avec leur ligne ; aucune ligne n'est gardée à moitié.
 */
export function parseQuizCsv(text: string): { rows: QuizBankRow[]; errors: QuizCsvError[] } {
  const table = splitCsv(text);
  const errors: QuizCsvError[] = [];
  const rows: QuizBankRow[] = [];
  const header = table[0]?.cells.map((c) => c.trim().toLowerCase());
  if (!header || header.join(";") !== QUIZ_CSV_HEADER.join(";")) {
    return { rows, errors: [{ line: 1, message: `en-tête attendu : ${QUIZ_CSV_HEADER.join(";")}` }] };
  }
  const seen = new Set<string>();
  for (const { line, cells } of table.slice(1)) {
    const fail = (message: string) => errors.push({ line, message });
    if (cells.length !== QUIZ_CSV_HEADER.length) {
      fail(`${cells.length} colonnes au lieu de ${QUIZ_CSV_HEADER.length}`);
      continue;
    }
    const v = Object.fromEntries(QUIZ_CSV_HEADER.map((k, i) => [k, cells[i]!.trim()])) as Record<(typeof QUIZ_CSV_HEADER)[number], string>;
    const before = errors.length;
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(v.id)) fail("id : lettres, chiffres, - ou _, 40 caractères au plus");
    else if (seen.has(v.id)) fail(`id « ${v.id} » en double`);
    if (!v.categorie || v.categorie.length > LIMITS.category) fail("categorie : obligatoire, 40 caractères au plus");
    if (!["1", "2", "3"].includes(v.difficulte)) fail("difficulte : 1, 2 ou 3");
    if (v.question_fr.length < 3 || v.question_fr.length > LIMITS.question) fail("question_fr : 3 à 300 caractères");
    if (v.question_en.length > LIMITS.question) fail("question_en : 300 caractères au plus");
    const answers: QuizBankAnswer[] = [];
    for (const n of [1, 2, 3, 4] as const) {
      const fr = v[`reponse${n}_fr`];
      const en = v[`reponse${n}_en`];
      if (!fr) {
        if (n <= 2) fail(`reponse${n}_fr : obligatoire`);
        else if (en) fail(`reponse${n}_en sans reponse${n}_fr`);
        continue;
      }
      if (answers.length !== n - 1) fail(`reponse${n}_fr sans reponse${n - 1}_fr`);
      if (fr.length > LIMITS.answer || en.length > LIMITS.answer) fail(`reponse${n} : 160 caractères au plus`);
      answers.push({ text: fr, text_en: en || null });
    }
    const good = Number(v.bonne_reponse);
    if (!/^[1-4]$/.test(v.bonne_reponse)) fail("bonne_reponse : 1 à 4");
    else if (good > answers.length) fail(`bonne_reponse ${good} : la réponse ${good} est vide`);
    seen.add(v.id);
    if (errors.length > before) continue;
    rows.push({
      id: v.id,
      category: v.categorie,
      difficulty: Number(v.difficulte) as 1 | 2 | 3,
      question: v.question_fr,
      question_en: v.question_en || null,
      answers,
      correct: good - 1,
    });
  }
  return { rows, errors };
}
