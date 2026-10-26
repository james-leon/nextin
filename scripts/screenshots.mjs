#!/usr/bin/env node
// Captures d'écran Playwright (tests marqués @screenshots) → docs/captures/<module>/, sous Windows comme ailleurs.
// Usage : pnpm --filter @nextin/web screenshots [-- e2e/screenshots-m4.spec.ts]
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, SCREENSHOTS: "1" },
});
process.exit(r.status ?? 1);
