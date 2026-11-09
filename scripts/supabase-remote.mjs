#!/usr/bin/env node
// Commandes vers le projet Supabase DISTANT (multiplateforme) : `link` ou `push`.
// Lit SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD dans l'environnement (jamais dans le code).
import { spawnSync } from "node:child_process";

const action = process.argv[2];
const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!["link", "push"].includes(action)) {
  console.error("Usage : node scripts/supabase-remote.mjs link|push");
  process.exit(2);
}
if (!ref || !password) {
  console.error("Variables requises : SUPABASE_PROJECT_REF et SUPABASE_DB_PASSWORD (Supabase → Project Settings → Database).");
  process.exit(2);
}
const args =
  action === "link"
    ? ["supabase", "link", "--project-ref", ref, "--password", password]
    : ["supabase", "db", "push", "--password", password];
const r = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
