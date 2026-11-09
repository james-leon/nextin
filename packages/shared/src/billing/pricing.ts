/**
 * Prix et cycle de vie des abonnements (M10a, docs/PLAN.md §11). Aucun prix ni durée en dur : les valeurs viennent
 * des tables `plans` et `platform_settings` (modifiables par le super admin).
 */

export const BILLING_PERIODS = ["monthly", "annual"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "read_only", "suspended"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_CHANNELS = ["mtn_momo", "orange_money"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/** Fonctions activables par formule (clés de `plans.features`). */
export const PLAN_FEATURES = [
  "voice_announcements",
  "appointments",
  "remote_tickets",
  "advanced_stats",
  "export",
  "multisite",
  "priority_support",
  "dedicated_support",
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/**
 * Limites d'une formule, toutes par établissement (null : illimité), dans l'ordre d'affichage ; mêmes clés que
 * `org_entitlements` et que les limites sur mesure (`subscriptions.limit_overrides`).
 */
export const ENTITLEMENT_LIMITS = [
  "included_branches",
  "max_services",
  "max_counters",
  "max_displays",
  "max_users",
  "tickets_per_month",
  "whatsapp_quota",
  "history_months",
] as const;
export type EntitlementLimit = (typeof ENTITLEMENT_LIMITS)[number];

/** Un quota du mois (`quota_status`) : consommation, limite (formule + extensions), jour où elle a été atteinte. */
export type QuotaItem = {
  used: number;
  base: number | null;
  extra: number;
  limit: number | null;
  percent: number | null;
  reached_on: string | null;
  blocked: boolean;
};
export type QuotaState = "ok" | "warning" | "reached" | "blocked";

/**
 * État d'un quota pour l'affichage : alerte à `alertPercent` (80 %), limite atteinte (la file continue jusqu'à la
 * fermeture du jour), bloqué à partir du lendemain. Même règle que `quota_item` / `quota_progress` (SQL).
 */
export function quotaState(item: QuotaItem | null | undefined, alertPercent = 80): QuotaState {
  if (!item || item.limit == null || item.limit <= 0) return "ok";
  if (item.blocked) return "blocked";
  if (item.used >= item.limit) return "reached";
  if (item.used * 100 >= item.limit * alertPercent) return "warning";
  return "ok";
}

/** Premier jour visible des statistiques (AAAA-MM-JJ) pour un historique de `months` mois ; null : tout l'historique. */
export function historyStart(today: string, months: number | null | undefined): string | null {
  if (months == null) return null;
  const [y = 1970, m = 1, d = 1] = today.slice(0, 10).split("-").map(Number);
  // Même calcul que `stats_history_start` : aujourd'hui − N mois (jour borné à la fin du mois), + 1 jour.
  const targetMonth = m - 1 - months;
  const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
  const start = new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay) + 1));
  return start.toISOString().slice(0, 10);
}

export type DiscountKind = "percent" | "fixed_xaf";

export type PriceInput = {
  /** Prix mensuel hors taxe pour `included` agences. */
  base: number;
  included: number;
  /** Prix mensuel d'une agence en plus ; null : agences au-delà non facturées (et non autorisées par la base). */
  extra: number | null;
  /** Mois offerts en paiement annuel. */
  freeMonths: number;
  branches: number;
  period: BillingPeriod;
  discount: { kind: DiscountKind; value: number } | null;
};

export type Price = {
  monthly: number;
  months: number;
  extraBranches: number;
  subtotal: number;
  discount: number;
  total: number;
};

/**
 * Miroir exact de `public.subscription_price` (fixtures partagées `pricing.fixtures.json`) : mensuel = base + agences en
 * plus × prix par agence ; annuel = mensuel × (12 − mois offerts) ; remise ensuite (pourcentage arrondi, ou montant
 * plafonné au prix).
 */
export function computeSubscriptionPrice(input: PriceInput): Price {
  const extraBranches = Math.max(0, (input.branches || 1) - input.included);
  const monthly = input.base + extraBranches * (input.extra ?? 0);
  const months = input.period === "annual" ? 12 - input.freeMonths : 1;
  const subtotal = monthly * months;
  let discount = 0;
  if (input.discount?.kind === "percent") {
    discount = Math.round((subtotal * Math.min(Math.max(input.discount.value, 0), 100)) / 100);
  } else if (input.discount?.kind === "fixed_xaf") {
    discount = Math.min(subtotal, Math.max(input.discount.value, 0));
  }
  return { monthly, months, extraBranches, subtotal, discount, total: subtotal - discount };
}

/** Économie annuelle par rapport à 12 mois payés au mois (FCFA). */
export function annualSavings(monthly: number, freeMonths: number): number {
  return monthly * Math.max(0, Math.min(freeMonths, 11));
}

export type LifecycleSubscription = {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  readOnlySince: string | null;
};

/**
 * Statut visé par les dates, miroir de `public.subscription_target_status` : fin d'essai → lecture seule ; échéance
 * dépassée → grâce ; fin de grâce → lecture seule ; `readOnlyDays` de lecture seule → suspendu. La base applique ensuite
 * la transition seulement après la fermeture de toutes les agences.
 */
export function targetStatus(s: LifecycleSubscription, readOnlyDays: number, now: Date): SubscriptionStatus {
  const passed = (iso: string | null, plusDays = 0) =>
    iso !== null && new Date(iso).getTime() + plusDays * 86_400_000 <= now.getTime();
  if (s.status === "trialing" && passed(s.trialEndsAt)) return "read_only";
  if (s.status === "active" && passed(s.currentPeriodEnd)) return "past_due";
  if (s.status === "past_due" && passed(s.graceEndsAt)) return "read_only";
  if (s.status === "read_only" && passed(s.readOnlySince, readOnlyDays)) return "suspended";
  return s.status;
}

/** Les tickets et rendez-vous peuvent-ils être émis dans ce statut ? */
export function canIssue(status: SubscriptionStatus): boolean {
  return status !== "read_only" && status !== "suspended";
}

/** Jours entiers restants avant une date (0 le jour même ou après). */
export function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}

export type BillingBanner =
  | { kind: "trial"; daysLeft: number }
  | { kind: "past_due"; daysLeft: number }
  | { kind: "read_only" }
  | { kind: "suspended" }
  | null;

/**
 * Bandeau du back-office : essai (7 derniers jours seulement), grâce, lecture seule, suspendu. Rien quand tout va bien
 * (déférence au contenu).
 */
export function billingBanner(
  s: { status: SubscriptionStatus; trialEndsAt: string | null; graceEndsAt: string | null } | null,
  now: Date,
): BillingBanner {
  if (!s) return null;
  switch (s.status) {
    case "trialing": {
      const daysLeft = daysUntil(s.trialEndsAt, now) ?? 0;
      return daysLeft <= 7 ? { kind: "trial", daysLeft } : null;
    }
    case "past_due":
      return { kind: "past_due", daysLeft: daysUntil(s.graceEndsAt, now) ?? 0 };
    case "read_only":
      return { kind: "read_only" };
    case "suspended":
      return { kind: "suspended" };
    default:
      return null;
  }
}

/** Numéro débité affiché masqué : « +2376•• •• •• 01 » (même format que la base). */
export function maskMsisdn(e164: string): string {
  return `${e164.slice(0, 5)}•• •• •• ${e164.slice(-2)}`;
}

/** Opérateur probable d'un numéro camerounais (préremplit le choix, l'utilisateur peut changer). */
export function guessChannel(e164: string): PaymentChannel | null {
  const m = /^\+237(6\d)(\d)/.exec(e164);
  if (!m) return null;
  const [, prefix, third] = m;
  // Plans de numérotation publics : MTN 67, 650–654, 680–684 ; Orange 69, 655–659, 685–689.
  if (prefix === "67") return "mtn_momo";
  if (prefix === "69") return "orange_money";
  if (prefix === "65" || prefix === "68") return Number(third) <= 4 ? "mtn_momo" : "orange_money";
  return null;
}
