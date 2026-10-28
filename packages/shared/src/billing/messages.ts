/**
 * Messages du compte (M10a) : code de vérification du directeur, rappels d'abonnement, avis de suppression, paiement
 * confirmé, alerte de quota. WhatsApp (modèles Meta, catégorie Utilité ; Authentification pour le code), SMS de
 * secours (GSM-7, 160 caractères) et e-mail. Jamais de donnée d'un client de l'établissement.
 */
import { formatXaf } from "../money";
import { fillTemplate, toGsm, WHATSAPP_TEMPLATES } from "../notifications/messages";
import type { NotifLocale } from "../notifications/opt-in";

export const ACCOUNT_MESSAGE_KINDS = ["phone_code", "billing_reminder", "deletion_notice", "payment_confirmed", "quota_alert"] as const;
export type AccountMessageKind = (typeof ACCOUNT_MESSAGE_KINDS)[number];
export type BillingReminder = "trial_end" | "period_end" | "grace" | "deletion";

/** Données du message (colonne `account_messages.payload`) plus le lien calculé par l'expéditeur. */
export type AccountMessageData = {
  code?: string;
  reminder?: BillingReminder;
  organization?: string;
  /** Date d'échéance (AAAA-MM-JJ, Douala). */
  date?: string;
  /** Fin de la grâce ou date de suppression (AAAA-MM-JJ). */
  until?: string | null;
  amount_xaf?: number | null;
  invoice?: string | null;
  period_end?: string;
  used?: number;
  quota?: number;
  /** `absoluteUrl('/pay/<jeton>')` ou la page Abonnement. */
  link?: string;
};

type AccountTemplate = {
  name: string;
  category: "utility" | "authentication";
  body: Record<NotifLocale, string>;
  params: (d: AccountMessageData, locale: NotifLocale) => string[];
};

/** « 12 novembre 2026 » / « November 12, 2026 » (date seule, sans fuseau). */
export function formatBillingDate(iso: string | null | undefined, locale: NotifLocale): string {
  if (!iso) return "";
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

const amount = (d: AccountMessageData, l: NotifLocale) => (d.amount_xaf != null ? formatXaf(d.amount_xaf, l) : "-");
const org = (d: AccountMessageData) => d.organization ?? "";
const link = (d: AccountMessageData) => d.link ?? "";

/** Modèles WhatsApp à faire approuver par Meta (texte exact ; même texte en message libre dans la fenêtre de 24 h). */
export const ACCOUNT_TEMPLATES: Record<Exclude<AccountMessageKind, "billing_reminder" | "deletion_notice"> | BillingReminder, AccountTemplate> = {
  // Même modèle d'authentification que la vérification des demandes de rendez-vous (M9).
  phone_code: {
    name: WHATSAPP_TEMPLATES.request_code.name,
    category: "authentication",
    body: WHATSAPP_TEMPLATES.request_code.body,
    params: (d) => [d.code ?? ""],
  },
  trial_end: {
    name: "rappel_fin_essai",
    category: "utility",
    body: {
      fr: "L'essai gratuit NextIn de {{1}} se termine le {{2}}.\nPour continuer à servir vos clients sans interruption, réglez votre abonnement ({{3}}) par MTN MoMo ou Orange Money : {{4}}",
      en: "The NextIn free trial for {{1}} ends on {{2}}.\nTo keep serving your customers without interruption, pay your subscription ({{3}}) with MTN MoMo or Orange Money: {{4}}",
    },
    params: (d, l) => [org(d), formatBillingDate(d.date, l), amount(d, l), link(d)],
  },
  period_end: {
    name: "rappel_echeance",
    category: "utility",
    body: {
      fr: "L'abonnement NextIn de {{1}} arrive à échéance le {{2}}.\nMontant : {{3}}. Payez par MTN MoMo ou Orange Money : {{4}}\nVotre facture sera disponible dans votre espace NextIn.",
      en: "The NextIn subscription for {{1}} is due on {{2}}.\nAmount: {{3}}. Pay with MTN MoMo or Orange Money: {{4}}\nYour invoice will be available in your NextIn account.",
    },
    params: (d, l) => [org(d), formatBillingDate(d.date, l), amount(d, l), link(d)],
  },
  grace: {
    name: "rappel_impaye",
    category: "utility",
    body: {
      fr: "L'abonnement NextIn de {{1}} n'est pas réglé depuis le {{2}}. Le service reste actif jusqu'au {{3}}, puis passera en lecture seule (plus de nouveaux tickets).\nMontant : {{4}}. Payez maintenant : {{5}}",
      en: "The NextIn subscription for {{1}} has been unpaid since {{2}}. The service stays active until {{3}}, then becomes read-only (no new tickets).\nAmount: {{4}}. Pay now: {{5}}",
    },
    params: (d, l) => [org(d), formatBillingDate(d.date, l), formatBillingDate(d.until, l), amount(d, l), link(d)],
  },
  deletion: {
    name: "avis_suppression",
    category: "utility",
    body: {
      fr: "Le compte NextIn de {{1}} est suspendu faute de paiement. Ses données seront supprimées le {{2}}.\nPour réactiver le service immédiatement, réglez {{3}} : {{4}}",
      en: "The NextIn account for {{1}} is suspended for non-payment. Its data will be deleted on {{2}}.\nTo reactivate the service immediately, pay {{3}}: {{4}}",
    },
    params: (d, l) => [org(d), formatBillingDate(d.until ?? d.date, l), amount(d, l), link(d)],
  },
  // Pas de « facture disponible » séparée : la confirmation de paiement porte le numéro et le lien des factures.
  payment_confirmed: {
    name: "paiement_confirme",
    category: "utility",
    body: {
      fr: "Paiement reçu : {{1}} pour l'abonnement NextIn de {{2}}. Merci !\nFacture {{3}}. Abonnement actif jusqu'au {{4}}.\nVos factures : {{5}}",
      en: "Payment received: {{1}} for the NextIn subscription of {{2}}. Thank you!\nInvoice {{3}}. Subscription active until {{4}}.\nYour invoices: {{5}}",
    },
    params: (d, l) => [amount(d, l), org(d), d.invoice ?? "", formatBillingDate(d.period_end, l), link(d)],
  },
  quota_alert: {
    name: "alerte_quota",
    category: "utility",
    body: {
      fr: "{{1}} a envoyé {{2}} des {{3}} messages WhatsApp inclus ce mois-ci. Au-delà, seuls les messages « C'est votre tour » partent sur WhatsApp ; les autres alertes passent par notification.\nChanger de formule : {{4}}",
      en: "{{1}} has sent {{2}} of the {{3}} WhatsApp messages included this month. Beyond that, only “It's your turn” messages go out on WhatsApp; other alerts are sent as notifications.\nChange plan: {{4}}",
    },
    params: (d) => [org(d), String(d.used ?? 0), String(d.quota ?? 0), link(d)],
  },
};

export function accountTemplateKey(kind: AccountMessageKind, data: AccountMessageData): keyof typeof ACCOUNT_TEMPLATES {
  if (kind === "billing_reminder") return data.reminder && data.reminder !== "deletion" ? data.reminder : "period_end";
  if (kind === "deletion_notice") return "deletion";
  return kind;
}

/** Variables propres du modèle (mêmes règles que les modèles de la file : ni retour à la ligne, ni variable vide). */
export function accountTemplateParams(kind: AccountMessageKind, locale: NotifLocale, data: AccountMessageData): string[] {
  return ACCOUNT_TEMPLATES[accountTemplateKey(kind, data)]
    .params(data, locale)
    .map((p) => p.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim() || "-");
}

export function accountWhatsappText(kind: AccountMessageKind, locale: NotifLocale, data: AccountMessageData): string {
  return fillTemplate(ACCOUNT_TEMPLATES[accountTemplateKey(kind, data)].body[locale], accountTemplateParams(kind, locale, data));
}

const SMS: Record<NotifLocale, Record<keyof typeof ACCOUNT_TEMPLATES, (d: AccountMessageData) => string>> = {
  fr: {
    phone_code: (d) => `NextIn : votre code de verification est ${d.code ?? ""}. Il expire dans 10 minutes. Ne le communiquez a personne.`,
    trial_end: (d) => `NextIn : essai de ${org(d)} termine le ${formatBillingDate(d.date, "fr")}. Payez : ${link(d)}`,
    period_end: (d) => `NextIn : abonnement de ${org(d)} a regler avant le ${formatBillingDate(d.date, "fr")}. ${link(d)}`,
    grace: (d) => `NextIn : abonnement impaye. Lecture seule le ${formatBillingDate(d.until, "fr")}. Payez : ${link(d)}`,
    deletion: (d) => `NextIn : compte suspendu, donnees supprimees le ${formatBillingDate(d.until ?? d.date, "fr")}. Payez : ${link(d)}`,
    payment_confirmed: (d) => `NextIn : paiement recu, facture ${d.invoice ?? ""}. Actif jusqu'au ${formatBillingDate(d.period_end, "fr")}. Merci !`,
    quota_alert: (d) => `NextIn : ${d.used ?? 0}/${d.quota ?? 0} messages WhatsApp utilises ce mois-ci. ${link(d)}`,
  },
  en: {
    phone_code: (d) => `NextIn: your verification code is ${d.code ?? ""}. It expires in 10 minutes. Do not share it.`,
    trial_end: (d) => `NextIn: ${org(d)} trial ends on ${formatBillingDate(d.date, "en")}. Pay: ${link(d)}`,
    period_end: (d) => `NextIn: ${org(d)} subscription due on ${formatBillingDate(d.date, "en")}. ${link(d)}`,
    grace: (d) => `NextIn: subscription unpaid. Read-only on ${formatBillingDate(d.until, "en")}. Pay: ${link(d)}`,
    deletion: (d) => `NextIn: account suspended, data deleted on ${formatBillingDate(d.until ?? d.date, "en")}. Pay: ${link(d)}`,
    payment_confirmed: (d) => `NextIn: payment received, invoice ${d.invoice ?? ""}. Active until ${formatBillingDate(d.period_end, "en")}. Thank you!`,
    quota_alert: (d) => `NextIn: ${d.used ?? 0}/${d.quota ?? 0} WhatsApp messages used this month. ${link(d)}`,
  },
};

export function accountSmsText(kind: AccountMessageKind, locale: NotifLocale, data: AccountMessageData): string {
  return toGsm(SMS[locale][accountTemplateKey(kind, data)](data));
}

const SUBJECTS: Record<NotifLocale, Record<keyof typeof ACCOUNT_TEMPLATES, (d: AccountMessageData) => string>> = {
  fr: {
    phone_code: () => "Votre code de vérification NextIn",
    trial_end: (d) => `Votre essai NextIn se termine le ${formatBillingDate(d.date, "fr")}`,
    period_end: (d) => `Échéance de votre abonnement NextIn le ${formatBillingDate(d.date, "fr")}`,
    grace: () => "Abonnement NextIn impayé : réglez-le pour éviter la lecture seule",
    deletion: (d) => `Compte NextIn suspendu : suppression le ${formatBillingDate(d.until ?? d.date, "fr")}`,
    payment_confirmed: (d) => `Paiement reçu · facture ${d.invoice ?? ""}`,
    quota_alert: () => "Quota de messages WhatsApp bientôt atteint",
  },
  en: {
    phone_code: () => "Your NextIn verification code",
    trial_end: (d) => `Your NextIn trial ends on ${formatBillingDate(d.date, "en")}`,
    period_end: (d) => `Your NextIn subscription is due on ${formatBillingDate(d.date, "en")}`,
    grace: () => "NextIn subscription unpaid: pay now to avoid read-only mode",
    deletion: (d) => `NextIn account suspended: deletion on ${formatBillingDate(d.until ?? d.date, "en")}`,
    payment_confirmed: (d) => `Payment received · invoice ${d.invoice ?? ""}`,
    quota_alert: () => "WhatsApp message quota almost reached",
  },
};

/** E-mail : objet et texte brut (même contenu que WhatsApp), signé NextIn by Wintek. */
export function accountEmail(kind: AccountMessageKind, locale: NotifLocale, data: AccountMessageData): { subject: string; text: string } {
  const key = accountTemplateKey(kind, data);
  const signature = locale === "fr" ? "— NextIn par Wintek" : "— NextIn by Wintek";
  return { subject: SUBJECTS[locale][key](data), text: `${accountWhatsappText(kind, locale, data)}\n\n${signature}` };
}
