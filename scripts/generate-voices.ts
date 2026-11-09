/**
 * Bibliothèque vocale de l'écran TV (M6) : un fichier MP3 par segment (mots, lettres A–Z, nombres 1–999)
 * et par langue, généré avec ElevenLabs puis déposé dans le bucket public Supabase `voices`,
 * avec `manifest.json` (liste des segments disponibles, lue par les écrans).
 * Idempotent : les segments déjà présents sont conservés (sauf --force).
 *
 * Usage : pnpm voices:generate [--lang fr|en] [--dry-run] [--force]
 * Variables : ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_FR, ELEVENLABS_VOICE_ID_EN, ELEVENLABS_MODEL_ID (facultatif),
 *             NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { voiceSegments, type AnnouncementLanguage } from "../packages/shared/src/announcements";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const langArg = args[args.indexOf("--lang") + 1];
const langs: AnnouncementLanguage[] = args.includes("--lang") && (langArg === "fr" || langArg === "en") ? [langArg] : ["fr", "en"];

const env = process.env;
const voices: Record<AnnouncementLanguage, string | undefined> = { fr: env.ELEVENLABS_VOICE_ID_FR, en: env.ELEVENLABS_VOICE_ID_EN };
const missing = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  ...(dryRun ? [] : ["ELEVENLABS_API_KEY", ...langs.map((l) => `ELEVENLABS_VOICE_ID_${l.toUpperCase()}`)]),
].filter((k) => !env[k]);
if (missing.length) {
  console.error(`Variables manquantes : ${missing.join(", ")}`);
  console.error("ElevenLabs : elevenlabs.io → Profile → API Keys, et Voice Library pour les identifiants de voix.");
  process.exit(1);
}

const BUCKET = "voices";
const MODEL = env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const CONCURRENCY = 4;
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function ensureBucket() {
  const { data } = await db.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(BUCKET, { public: true, allowedMimeTypes: ["audio/mpeg", "application/json"] });
  if (error) throw error;
}

async function existing(prefix: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const f of data) if (f.name.endsWith(".mp3")) out.add(`${prefix}/${f.name.slice(0, -4)}`);
    if (data.length < 1000) return out;
  }
}

async function synthesize(lang: AnnouncementLanguage, text: string): Promise<ArrayBuffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voices[lang]}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL, language_code: lang, voice_settings: { stability: 0.6, similarity_boost: 0.8 } }),
    });
    if (res.ok) return res.arrayBuffer();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${res.status} pour « ${text} » : ${await res.text()}`);
  }
}

async function main() {
  await ensureBucket();
  const present = new Set<string>();
  for (const lang of ["fr", "en"] as const) (await existing(lang)).forEach((k) => present.add(k));

  const todo = langs.flatMap((lang) => voiceSegments(lang).map((s) => ({ ...s, lang }))).filter((s) => force || !present.has(s.key));
  console.log(`${todo.length} segment(s) à générer (${present.size} déjà présents).`);
  if (dryRun) return;

  let done = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const audio = await synthesize(s.lang, s.text);
        const { error } = await db.storage
          .from(BUCKET)
          .upload(`${s.key}.mp3`, audio, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: true });
        if (error) throw error;
        present.add(s.key);
        if (++done % 50 === 0) console.log(`  ${done}/${todo.length}`);
      }
    }),
  );

  const manifest = JSON.stringify({ generatedAt: new Date().toISOString(), keys: [...present].sort() });
  const { error } = await db.storage
    .from(BUCKET)
    .upload("manifest.json", new Blob([manifest], { type: "application/json" }), { contentType: "application/json", cacheControl: "60", upsert: true });
  if (error) throw error;
  console.log(`✓ ${done} segment(s) générés ; manifest.json : ${present.size} segments.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
