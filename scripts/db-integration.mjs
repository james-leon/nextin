#!/usr/bin/env node
// Tests d'intégration contre le Supabase local (supabase/tests/integration/*.test.ts, node:test) :
// concurrence des appels et diffusion temps réel. Clés locales lues via `supabase status` (aucun secret).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { localEnv } from "./local-env.mjs";

const shell = process.platform === "win32";
const status = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", shell, env: localEnv() });
let keys;
try {
  keys = JSON.parse(status.stdout.slice(status.stdout.indexOf("{")));
} catch {
  console.error("Supabase local injoignable : lancez d'abord `pnpm db:start`.");
  process.exit(1);
}

// Passerelle prête (elle peut redémarrer juste après `pnpm db:reset`).
for (let i = 0; ; i++) {
  const ok = await fetch(`${keys.API_URL}/rest/v1/`, { headers: { apikey: keys.ANON_KEY } }).then((r) => r.status < 500, () => false);
  if (ok) break;
  if (i >= 60) {
    console.error("Passerelle Supabase locale injoignable.");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

const DIR = "supabase/tests/integration";
const files = readdirSync(DIR).filter((f) => f.endsWith(".test.ts")).sort().map((f) => join(DIR, f));
const r = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...files], {
  stdio: "inherit",
  env: { ...localEnv(), IT_SUPABASE_URL: keys.API_URL, IT_ANON_KEY: keys.ANON_KEY, IT_SERVICE_ROLE_KEY: keys.SERVICE_ROLE_KEY },
});
process.exit(r.status ?? 1);
