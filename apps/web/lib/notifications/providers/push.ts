import { randomUUID } from "node:crypto";
import webpush from "web-push";
import type { PushProvider } from "./types";

/** Web push (VAPID) : notification sur le téléphone même page fermée (Android, iPhone avec l'app installée). */
export function webPush(config: { publicKey: string; privateKey: string; subject: string }): PushProvider {
  return {
    name: "web-push",
    async send(subscription, payload) {
      try {
        const res = await webpush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: 15 * 60,
          urgency: "high",
          topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
          vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
          timeout: 10_000,
        });
        return { ok: true, messageId: res.headers.location ?? `push.${randomUUID()}` };
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? 0;
        // 404 / 410 : abonnement expiré ou retiré par l'utilisateur.
        if (status === 404 || status === 410) return { ok: false, retryable: false, gone: true, error: `push ${status}` };
        return { ok: false, retryable: status === 0 || status === 429 || status >= 500, error: `push ${status || (e as Error).message}` };
      }
    },
  };
}

export function fakePush(log: (line: string) => void = () => undefined): PushProvider {
  return {
    name: "fake",
    async send(subscription, payload) {
      log(`[push:fake] ${new URL(subscription.endpoint).host} ${payload.title} — ${payload.body}`);
      return { ok: true, messageId: `fake.${randomUUID()}` };
    },
  };
}
