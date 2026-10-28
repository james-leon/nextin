#!/usr/bin/env node
// M7 — Indique à la base où réveiller l'expéditeur des notifications (pg_net → POST <APP_URL>/api/notifications/dispatch).
// L'adresse et le secret sont rangés dans Supabase Vault (fonction configure_notification_dispatch, service role).
// Variables : APP_URL, NOTIFY_DISPATCH_SECRET (≥ 32 caractères), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Usage : pnpm notify:configure   (à relancer si APP_URL ou NOTIFY_DISPATCH_SECRET change)
const env = process.env;
const missing = ["APP_URL", "NOTIFY_DISPATCH_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !env[k]);
if (missing.length) {
  console.error(`Variables manquantes : ${missing.join(", ")}`);
  process.exit(2);
}
if (env.NOTIFY_DISPATCH_SECRET.length < 32) {
  console.error("NOTIFY_DISPATCH_SECRET doit compter au moins 32 caractères (ex. : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\").");
  process.exit(2);
}
const url = new URL("/api/notifications/dispatch", env.APP_URL).toString();
if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.)/.test(url)) {
  console.warn("Attention : APP_URL est une adresse locale, que la base distante ne peut pas joindre. En local, l'application envoie elle-même les messages.");
}
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/configure_notification_dispatch`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ p_url: url, p_secret: env.NOTIFY_DISPATCH_SECRET }),
});
if (!res.ok) {
  console.error(`Échec (${res.status}) : ${await res.text()}`);
  process.exit(1);
}
console.log(`Expéditeur configuré : ${url}`);
