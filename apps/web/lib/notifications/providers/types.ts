/** Résultat d'un envoi : identifiant du fournisseur, ou erreur (temporaire = nouvel essai). */
export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; retryable: boolean; error: string; gone?: boolean };

export interface WhatsAppProvider {
  readonly name: "cloud" | "fake";
  /** Message libre (fenêtre de 24 h ouverte par le client). `to` : numéro E.164. */
  sendText(to: string, text: string): Promise<SendResult>;
  /** Modèle approuvé (hors fenêtre). */
  sendTemplate(to: string, template: string, language: "fr" | "en", params: readonly string[]): Promise<SendResult>;
}

export interface SmsProvider {
  readonly name: "console";
  send(to: string, text: string): Promise<SendResult>;
}

export type PushSubscriptionJson = { endpoint: string; keys: { p256dh: string; auth: string } };

export interface PushProvider {
  readonly name: "web-push" | "fake";
  send(subscription: PushSubscriptionJson, payload: { title: string; body: string; url: string; tag: string }): Promise<SendResult>;
}

/** Numéro masqué pour les journaux : jamais de numéro complet dans les logs. */
export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 4)}…${phone.slice(-2)}` : "…";
}
