#!/usr/bin/env node
// Lance l'application pour un test sur téléphone, sur le même Wi-Fi que ce PC (Windows, macOS, Linux) :
// - Supabase LOCAL (pnpm db:start) joint par l'adresse IP du PC ;
// - APP_URL = http://<IP>:3000 : les QR codes et liens (back-office, PDF) pointent vers ce PC, pas vers localhost ;
// - serveur Next.js ouvert sur le réseau local.
//
// --remote : sans Docker, contre le projet Supabase distant. L'URL et les clés Supabase restent celles de
// apps/web/.env.local (ou de l'environnement) ; seuls APP_URL et DEV_LAN_HOST sont remplacés.
// Dans Supabase → Authentication → Sign In / Providers, « Allow anonymous sign-ins » doit être activé.
//
// Usage : pnpm dev:lan [--remote] [--host 192.168.1.20] [--port 3000]
import { spawnSync, spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { localEnv } from "./local-env.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
// « pnpm dev:lan -- --host … » transmet aussi le séparateur « -- ».

/** Adresse IPv4 privée du PC (Wi-Fi ou Ethernet) : 192.168.x.x, puis 10.x.x.x, puis 172.16–31.x.x. */
function lanAddress() {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  const rank = (ip) =>
    ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 9;
  return all.sort((a, b) => rank(a) - rank(b)).find((ip) => rank(ip) < 9) ?? null;
}

const host = arg("host") ?? lanAddress();
const port = arg("port") ?? "3000";
if (!host) {
  console.error("Adresse IP du PC introuvable. Connectez-vous au Wi-Fi ou passez-la : pnpm dev:lan --host 192.168.1.20");
  process.exit(1);
}

const shell = process.platform === "win32";
const remote = args.includes("--remote");
const appUrl = `http://${host}:${port}`;
let env;

if (remote) {
  // Les variables de apps/web/.env.local sont chargées par Next.js ; l'environnement du terminal prime.
  env = { ...process.env, APP_URL: appUrl, DEV_LAN_HOST: host };
} else {
  const status = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", shell, env: localEnv() });
  let keys;
  try {
    keys = JSON.parse(status.stdout.slice(status.stdout.indexOf("{")));
  } catch {
    console.error("Supabase local injoignable : lancez d'abord `pnpm db:start` (Docker Desktop ouvert),");
    console.error("ou utilisez le projet distant : pnpm dev:lan --remote");
    process.exit(1);
  }
  const supabasePort = new URL(keys.API_URL).port || "54321";
  env = {
    ...localEnv(),
    APP_URL: appUrl,
    NEXT_PUBLIC_SUPABASE_URL: `http://${host}:${supabasePort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: keys.SERVICE_ROLE_KEY,
    DEV_LAN_HOST: host,
  };
}

console.log(`
  NextIn sur le réseau local${remote ? " (Supabase distant)" : ""}
  ──────────────────────────
  Application : ${appUrl}
  Supabase    : ${remote ? "projet distant (apps/web/.env.local)" : env.NEXT_PUBLIC_SUPABASE_URL}

  Sur le téléphone (même Wi-Fi) : ouvrez ${appUrl}/q/<code court de l'agence>,
  ou scannez le QR code affiché dans le back-office (il pointe maintenant vers ${appUrl}).
  Au premier lancement, autorisez Node.js${remote ? "" : " et Docker"} dans le pare-feu (réseau privé).${
    remote ? "\n  Supabase → Authentication → « Allow anonymous sign-ins » doit être activé." : ""
  }
  Turnstile en local : aucune clé, ou les clés de test officielles de Cloudflare.
`);

const child = spawn("pnpm", ["--filter", "@nextin/web", "exec", "next", "dev", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell,
  env,
});
child.on("exit", (code) => process.exit(code ?? 0));
