#!/usr/bin/env node
// Régénère packages/shared/src/types/database.ts depuis la base locale (multiplateforme).
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { localEnv } from "./local-env.mjs";

const OUT = "packages/shared/src/types/database.ts";
const result = spawnSync("npx", ["supabase", "gen", "types", "typescript", "--local", "--schema", "public"], {
  env: localEnv(),
  shell: process.platform === "win32",
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}
writeFileSync(OUT, `// Généré par \`pnpm db:types\` (supabase gen types) — ne pas modifier à la main.\n${result.stdout}`);
console.log(`✓ ${OUT}`);
