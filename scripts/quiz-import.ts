// Import de la banque de questions du quiz « série sans fin » (LOT 5b) : `pnpm quiz:import <fichier.csv> [--dry-run]`.
// Fichier UTF-8, séparateur point-virgule, en-tête :
//   id;categorie;difficulte;question_fr;question_en;reponse1_fr;reponse1_en;reponse2_fr;reponse2_en;reponse3_fr;reponse3_en;reponse4_fr;reponse4_en;bonne_reponse
// Idempotent par identifiant : une ligne déjà importée est mise à jour (et réactivée), jamais dupliquée ; les questions
// absentes du fichier ne sont pas touchées. Rien n'est écrit si une seule ligne est invalide.
// Service role (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, lues dans apps/web/.env.local s'il existe) ;
// contre le Supabase local : `node scripts/local-env.mjs pnpm quiz:import <fichier.csv>`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseQuizCsv } from "../packages/shared/src/games/quiz-bank";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage : pnpm quiz:import <fichier.csv> [--dry-run]");
  process.exit(2);
}

let text: string;
try {
  // pnpm lance le script depuis la racine du dépôt ; INIT_CWD = dossier d'où la commande a été tapée.
  text = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), file), "utf8");
} catch (e) {
  console.error(`Fichier illisible : ${file} (${(e as Error).message})`);
  process.exit(1);
}

const { rows, errors } = parseQuizCsv(text);
if (errors.length) {
  console.error(`${errors.length} erreur(s), rien n'a été importé :`);
  for (const e of errors) console.error(`  ligne ${e.line} : ${e.message}`);
  process.exit(1);
}
if (!rows.length) {
  console.error("Aucune question dans le fichier.");
  process.exit(1);
}
console.log(`${rows.length} question(s) valides.`);
if (dryRun) {
  console.log("Vérification seule (--dry-run) : rien n'a été écrit.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function main(client: typeof db) {
const existing = new Set<string>();
for (let i = 0; i < rows.length; i += 200) {
  const ids = rows.slice(i, i + 200).map((r) => r.id);
  const { data, error } = await client.from("quiz_bank_questions").select("id").in("id", ids);
  if (error) {
    console.error(`Lecture impossible : ${error.message}`);
    process.exit(1);
  }
  for (const r of data ?? []) existing.add(r.id as string);
}

for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200).map((r) => ({ ...r, active: true }));
  const { error } = await client.from("quiz_bank_questions").upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`Import interrompu (lignes ${i + 2} à ${i + batch.length + 1}) : ${error.message}`);
    process.exit(1);
  }
}
const updated = rows.filter((r) => existing.has(r.id)).length;
console.log(`Import terminé : ${rows.length - updated} ajoutée(s), ${updated} mise(s) à jour.`);
}

main(db).catch((e: unknown) => {
  console.error(`Import interrompu : ${(e as Error).message}`);
  process.exit(1);
});
