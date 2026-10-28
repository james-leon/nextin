/** Démarrage du serveur : envoi local des notifications en développement (ou avec NOTIFY_POLL=1). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "development" && process.env.NOTIFY_POLL !== "1") return;
  const { startNotificationPoller } = await import("./lib/notifications/poller");
  startNotificationPoller();
}
