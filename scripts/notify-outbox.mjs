#!/usr/bin/env node
// M7 — Derniers messages de la file d'envoi (faux fournisseurs : c'est ici qu'on lit ce qui « serait parti »).
// Usage : pnpm notify:outbox [nombre]   Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
const env = process.env;
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Variables requises : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const limit = Math.min(Number(process.argv[2]) || 20, 200);
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notification_jobs?select=created_at,event,channel,status,template_name,provider_message_id,error,payload&order=created_at.desc&limit=${limit}`;
const res = await fetch(url, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
if (!res.ok) {
  console.error(`Échec (${res.status}) : ${await res.text()}`);
  process.exit(1);
}
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Douala" });
for (const j of (await res.json()).reverse()) {
  console.log(`${time.format(new Date(j.created_at))}  ${j.channel.padEnd(8)} ${j.status.padEnd(9)} ${j.event}${j.template_name ? ` (modèle ${j.template_name})` : ""}${j.error ? ` — ${j.error}` : ""}`);
  if (j.provider_message_id) console.log(`          id : ${j.provider_message_id}`);
  if (j.payload?.text) console.log(`          ${j.payload.text.replace(/\n/g, "\n          ")}`);
}
