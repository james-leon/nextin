#!/usr/bin/env node
// M7 — Simule WhatsApp en local (compte Meta pas encore prêt) : envoie au webhook un message entrant ou un statut,
// signé comme Meta avec WHATSAPP_APP_SECRET.
// Usage :
//   pnpm whatsapp:simulate "NEXTIN C-047 7K3Q" [--from 237690000001]   message du client (opt-in, STOP, START…)
//   pnpm whatsapp:simulate --status <id du message> delivered|read|failed
// Variables : APP_URL (adresse de l'application lancée), WHATSAPP_APP_SECRET (toute valeur en local).
import { createHmac, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const { APP_URL, WHATSAPP_APP_SECRET } = process.env;
if (!APP_URL || !WHATSAPP_APP_SECRET) {
  console.error("Variables requises : APP_URL et WHATSAPP_APP_SECRET (dans apps/web/.env.local).");
  process.exit(2);
}
const from = opt("--from") ?? "237690000001";
const statusId = opt("--status");
const value = statusId
  ? { statuses: [{ id: statusId, status: args[args.indexOf("--status") + 2] ?? "delivered", recipient_id: from, timestamp: `${Math.floor(Date.now() / 1000)}` }] }
  : {
      contacts: [{ wa_id: from, profile: { name: "Simulation" } }],
      messages: [{ id: `wamid.sim.${randomUUID()}`, from, timestamp: `${Math.floor(Date.now() / 1000)}`, type: "text", text: { body: args.find((a) => !a.startsWith("--") && a !== opt("--from")) ?? "" } }],
    };
const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "sim", changes: [{ field: "messages", value: { messaging_product: "whatsapp", ...value } }] }] });
const signature = `sha256=${createHmac("sha256", WHATSAPP_APP_SECRET).update(body).digest("hex")}`;
const res = await fetch(new URL("/api/whatsapp/webhook", APP_URL), {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
  body,
});
console.log(`${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
