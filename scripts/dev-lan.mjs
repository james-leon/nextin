#!/usr/bin/env node
// Lance l'application pour un test sur téléphone, sur le même Wi-Fi que ce PC (Windows, macOS, Linux) :
// - Supabase LOCAL (pnpm db:start) joint par l'adresse IP du PC ;
// - APP_URL = http://<IP>:3000 : les QR codes et liens (back-office, PDF) pointent vers ce PC, pas vers localhost ;
// - serveur Next.js ouvert sur le réseau local.
// Usage : pnpm dev:lan [-- --host 192.168.1.20] [--port 3000]
import { spawnSync, spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { localEnv } from "./local-env.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

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
  console.error("Adresse IP du PC introuvable. Connectez-vous au Wi-Fi ou passez-la : pnpm dev:lan -- --host 192.168.1.20");
  process.exit(1);
}

const shell = process.platform === "win32";
const status = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", shell, env: localEnv() });
let keys;
try {
  keys = JSON.parse(status.stdout.slice(status.stdout.indexOf("{")));
} catch {
  console.error("Supabase local injoignable : lancez d'abord `pnpm db:start` (Docker Desktop ouvert).");
  process.exit(1);
}
const supabasePort = new URL(keys.API_URL).port || "54321";
const appUrl = `http://${host}:${port}`;

console.log(`
  NextIn sur le réseau local
  ──────────────────────────
  Application : ${appUrl}
  Supabase    : http://${host}:${supabasePort}

  Sur le téléphone (même Wi-Fi) : ouvrez ${appUrl}/q/<code court de l'agence>,
  ou scannez le QR code affiché dans le back-office (il pointe maintenant vers ${appUrl}).
  Au premier lancement, autorisez Node.js et Docker dans le pare-feu (réseau privé).
`);

const child = spawn("pnpm", ["--filter", "@nextin/web", "exec", "next", "dev", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell,
  env: {
    ...localEnv(),
    APP_URL: appUrl,
    NEXT_PUBLIC_SUPABASE_URL: `http://${host}:${supabasePort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: keys.SERVICE_ROLE_KEY,
    DEV_LAN_HOST: host,
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
