/** Secrets de test non sensibles (M7, M10a), passés au serveur des tests e2e (playwright.config.ts). */
export const E2E_NOTIFY = {
  WHATSAPP_APP_SECRET: "e2e-whatsapp-app-secret",
  WHATSAPP_VERIFY_TOKEN: "e2e-verify-token",
  NOTIFY_DISPATCH_SECRET: "e2e-dispatch-secret-0123456789abcdef0123456789",
  NEXT_PUBLIC_WHATSAPP_NUMBER: "237600000000",
  // M10a : faux fournisseur de paiement, validation « sur le téléphone » en 1 s.
  PAYMENT_PROVIDER: "fake",
  PAYMENT_WEBHOOK_SECRET: "e2e-payment-webhook-secret-0123456789",
  PAYMENT_FAKE_DELAY_MS: "1000",
  EMAIL_PROVIDER: "console",
};
