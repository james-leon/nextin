#!/usr/bin/env node
// Réinitialise le Supabase local (migrations rejouées), puis redémarre la passerelle Kong :
// la réinitialisation redémarre Realtime, dont Kong garderait sinon l'ancienne adresse en cache
// (abonnements temps réel en échec pendant plusieurs minutes).
import { spawnSync } from "node:child_process";
import { runLocal } from "./local-env.mjs";

const status = runLocal("npx", ["supabase", "db", "reset", ...process.argv.slice(2)]);
if (status !== 0) process.exit(status);
const kong = process.env.SUPABASE_KONG_CONTAINER ?? "supabase_kong_nextin";
spawnSync("docker", ["restart", kong], { stdio: "ignore", shell: process.platform === "win32" });
process.exit(0);
