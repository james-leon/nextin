#!/usr/bin/env node
// Suppression des données créées par les tests e2e (revue responsive §3) : établissements, annonceurs et comptes
// `@nextin.test` (requête : scripts/e2e-cleanup.sql). Par défaut, Supabase local (`pnpm db:start`).
// `--remote` : projet distant lié (`pnpm db:link`, SUPABASE_ACCESS_TOKEN dans l'environnement) — aucune clé dans le code.
import { spawnSync } from "node:child_process";
import { localEnv } from "./local-env.mjs";

const remote = process.argv.includes("--remote");
const target = remote ? "--linked" : "--local";
const env = remote ? process.env : localEnv();
const run = (extra) =>
  spawnSync("npx", ["supabase", "db", "query", target, ...extra], { encoding: "utf8", shell: process.platform === "win32", env });

// Décompte (une requête par appel : la CLI n'accepte qu'une instruction), puis suppression en un bloc transactionnel.
const COUNT = `select
  (select count(*) from public.organizations o where exists (select 1 from public.memberships m where m.organization_id = o.id)
     and not exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
                     where m.organization_id = o.id and u.email not like '%@nextin.test')) as organizations,
  (select count(*) from public.advertisers a where exists (select 1 from public.advertiser_members m where m.advertiser_id = a.id)
     and not exists (select 1 from public.advertiser_members m join auth.users u on u.id = m.user_id
                     where m.advertiser_id = a.id and u.email not like '%@nextin.test')) as advertisers,
  (select count(*) from auth.users where email like '%@nextin.test') as users`;

const fail = (r) => {
  console.error(r.stderr || r.stdout || "Échec du nettoyage.");
  console.error(remote ? "Projet distant : `pnpm db:link` puis SUPABASE_ACCESS_TOKEN." : "Supabase local lancé ? `pnpm db:start`.");
  process.exit(1);
};
const count = run([COUNT.replace(/\s+/g, " ")]);
if (count.status !== 0 || count.stdout.includes('"_tag":"Error"')) fail(count);
const del = run(["-f", "scripts/e2e-cleanup.sql"]);
if (del.status !== 0 || del.stdout.includes('"_tag":"Error"')) fail(del);
const row = /\{[^{}]*"organizations"[^{}]*\}/.exec(count.stdout)?.[0];
const n = row ? JSON.parse(row) : null;
console.log(
  n
    ? `Données e2e supprimées : ${n.organizations} établissement(s), ${n.advertisers} annonceur(s), ${n.users} compte(s).`
    : "Données e2e supprimées.",
);
