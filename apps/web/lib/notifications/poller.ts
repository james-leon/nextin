import "server-only";
import { dispatchNotifications } from "./dispatcher";

const INTERVAL_MS = 3_000;

/**
 * Envoi local sans pg_net (développement, `pnpm dev:lan --remote`, tests e2e) : la base ne peut pas joindre
 * l'ordinateur de développement, l'application interroge donc la file elle-même toutes les 3 s.
 * En production, la base réveille l'expéditeur (`pnpm notify:configure`).
 */
export function startNotificationPoller() {
  const g = globalThis as { __nextinNotifyPoller?: ReturnType<typeof setInterval> };
  if (g.__nextinNotifyPoller) return;
  let warned = false;
  g.__nextinNotifyPoller = setInterval(() => {
    dispatchNotifications({ budgetMs: 2_500 }).catch((e: Error) => {
      if (!warned) console.warn(`[notifications] envoi local impossible : ${e.message}`);
      warned = true;
    });
  }, INTERVAL_MS);
}
