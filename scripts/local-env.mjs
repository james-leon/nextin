#!/usr/bin/env node
// Lance une commande contre le Supabase LOCAL, sous Windows comme sous Linux/macOS :
// retire de l'environnement les variables du projet distant, qui priment sinon sur apps/web/.env.local
// et que la CLI Supabase lit (SUPABASE_DB_PASSWORD…).
// Usage : node scripts/local-env.mjs <commande> [arguments…]
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const REMOTE_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "APP_URL",
];

export function localEnv(base = process.env) {
  const env = { ...base };
  for (const name of REMOTE_VARS) delete env[name];
  return env;
}

export function runLocal(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32", env: localEnv(), ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("Usage : node scripts/local-env.mjs <commande> [arguments…]");
    process.exit(2);
  }
  process.exit(runLocal(command, args));
}
