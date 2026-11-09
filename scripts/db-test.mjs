#!/usr/bin/env node
// Exécute les tests pgTAP (supabase/tests/database/*.test.sql) dans le conteneur Postgres local
// (docker exec : aucun psql à installer, fonctionne sous Windows). Échoue si un test échoue.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_nextin";
const DIR = "supabase/tests/database";
let failed = false;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".test.sql")).sort()) {
  const sql = readFileSync(join(DIR, file), "utf8");
  const r = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const lines = `${r.stdout ?? ""}\n${r.stderr ?? ""}`
    .split(/\r?\n/)
    .filter((l) => /^(ok|not ok|#|1\.\.|psql:|ERROR)/.test(l));
  console.log(`# ${file}`);
  for (const l of lines) console.log(l);
  if (r.status !== 0 || lines.some((l) => /^(not ok|psql:|ERROR)/.test(l) || /Looks like/.test(l))) failed = true;
}
process.exit(failed ? 1 : 0);
