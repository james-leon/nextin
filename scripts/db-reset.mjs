#!/usr/bin/env node
// Réinitialise le Supabase local (migrations rejouées), puis redémarre la passerelle Kong :
// la réinitialisation redémarre Realtime, dont Kong garderait sinon l'ancienne adresse en cache
// (abonnements temps réel en échec pendant plusieurs minutes). Attend ensuite que la passerelle réponde.
import { spawnSync } from "node:child_process";
import { localEnv, runLocal } from "./local-env.mjs";

const code = runLocal("npx", ["supabase", "db", "reset", ...process.argv.slice(2)]);
if (code !== 0) process.exit(code);
const kong = process.env.SUPABASE_KONG_CONTAINER ?? "supabase_kong_nextin";
spawnSync("docker", ["restart", kong], { stdio: "ignore", shell: process.platform === "win32" });

// Rend la main quand la passerelle répond (seed ou tests lancés juste après).
const status = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", shell: process.platform === "win32", env: localEnv() });
try {
  const { API_URL, ANON_KEY } = JSON.parse(status.stdout.slice(status.stdout.indexOf("{")));
  for (let i = 0; i < 60; i++) {
    const ok = await fetch(`${API_URL}/rest/v1/`, { headers: { apikey: ANON_KEY } }).then((r) => r.status < 500, () => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
} catch {
  // Statut illisible : la passerelle finira de démarrer d'elle-même.
}
process.exit(0);
