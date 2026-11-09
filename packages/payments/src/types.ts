/**
 * Contrat d'un agrégateur Mobile Money (docs/payment-providers.md). Un adaptateur par fournisseur ; NextIn ne dépend
 * que de cette interface. Côté serveur uniquement (secrets, signatures).
 */

export type PaymentChannel = "mtn_momo" | "orange_money";
export type ProviderPaymentStatus = "pending" | "succeeded" | "failed" | "expired";

export type CheckoutRequest = {
  /** Référence NextIn (`nx_…`), unique : clé d'idempotence côté agrégateur et dans les webhooks. */
  externalId: string;
  amountXaf: number;
  channel: PaymentChannel;
  /** Numéro débité, E.164. Jamais enregistré en clair par NextIn. */
  msisdn: string;
  description: string;
  /** `absoluteUrl('/api/payments/webhook/<fournisseur>')`. */
  callbackUrl: string;
  /** Page de retour (`/pay/<jeton>`) pour les fournisseurs à page hébergée. */
  returnUrl: string;
};

export type CheckoutResult = {
  /** Référence du fournisseur (null si elle n'arrive qu'avec le webhook). */
  providerRef: string | null;
  status: ProviderPaymentStatus;
  /** Page hébergée à ouvrir, sinon confirmation sur le téléphone (code secret Mobile Money). */
  redirectUrl: string | null;
};

export type PaymentEvent = {
  /** Identifiant de l'événement pour l'idempotence du webhook (`record_webhook_event`). */
  eventId: string;
  externalId: string;
  status: ProviderPaymentStatus;
  providerRef: string | null;
  failureReason: string | null;
};

export interface PaymentProvider {
  readonly name: "fake" | "notchpay" | "fapshi" | "mesomb" | "cinetpay" | "flutterwave";
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  /** Signature du webhook vérifiée sur le corps brut, en temps constant. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseEvent(rawBody: string): PaymentEvent;
  /** Revérification auprès du fournisseur (rattrapage d'un webhook perdu, page de paiement). */
  fetchStatus(externalId: string, providerRef: string | null): Promise<PaymentEvent>;
}
