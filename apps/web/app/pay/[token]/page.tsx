import type { Metadata } from "next";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { PayView } from "@/components/pay/pay-view";
import { callRpc } from "@/lib/client/supabase-public";
import { LiteIntlProvider } from "@/lib/i18n/lite";
import type { PayInvoiceView } from "@/lib/payments/types";
import { captchaConfig } from "@/lib/security/captcha";

type Params = { params: Promise<{ token: string }> };

async function load(token: string): Promise<PayInvoiceView | null> {
  if (!/^[A-Za-z0-9]{32}$/.test(token)) return null;
  const { data } = await callRpc<PayInvoiceView | null>("pay_invoice_view", { p_token: token });
  return data;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pay");
  // Lien personnel : jamais indexé.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Lien de paiement `{APP_URL}/pay/<jeton>` (§11.5) : page publique légère, sans compte (le payeur peut être le
 * comptable). Montant en héros, choix MTN MoMo ou Orange Money, numéro à débiter, puis validation sur le téléphone.
 */
export default async function PayPage({ params }: Params) {
  const { token } = await params;
  const [view, locale, m] = await Promise.all([load(token), getLocale(), getMessages()]);
  return (
    <LiteIntlProvider locale={locale} messages={{ common: m.common, errors: m.errors, pay: m.pay, channels: m.channels }}>
      <PayView
        token={token}
        initial={view}
        captchaSiteKey={captchaConfig().siteKey}
        demo={(process.env.PAYMENT_PROVIDER?.trim() || "fake") === "fake"}
      />
    </LiteIntlProvider>
  );
}
