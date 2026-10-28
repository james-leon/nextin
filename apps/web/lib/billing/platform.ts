import type { SubscriptionStatus } from "@nextin/shared/billing";

/** Ligne de `admin_subscriptions`. */
export type AdminSubscriptionRow = {
  id: string;
  organization_id: string;
  organization: string;
  org_type: string;
  org_status: "pending" | "active" | "suspended";
  plan: string;
  plan_name: string;
  status: SubscriptionStatus;
  billing_period: "monthly" | "annual";
  trial_ends_at: string | null;
  current_period_end: string | null;
  pending_status: SubscriptionStatus | null;
  pending_status_after: string | null;
  deletion_due_at: string | null;
  branches: number;
  last_payment: { paid_at: string; total_xaf: number; channel: string | null } | null;
  created_at: string;
};

/** Réponse de `admin_revenue`. */
export type AdminRevenue = {
  mrr_xaf: number;
  collected_month_xaf: number;
  by_plan: { code: string; name: string; paying: number; trialing: number }[];
  by_status: Partial<Record<SubscriptionStatus, number>>;
  trials_started: number;
  trials_converted: number;
  collected_by_month: { month: string; total_xaf: number }[];
};

/** Réponse de `admin_subscription_detail`. */
export type AdminSubscriptionDetail = {
  subscription: {
    id: string;
    organization_id: string;
    plan_id: string;
    status: SubscriptionStatus;
    billing_period: "monthly" | "annual";
    trial_ends_at: string | null;
    current_period_end: string | null;
    grace_ends_at: string | null;
    deletion_due_at: string | null;
    pending_status: SubscriptionStatus | null;
    pending_status_after: string | null;
  };
  organization: { id: string; name: string; type: string; status: "pending" | "active" | "suspended"; suspended_reason: string | null; created_at: string };
  events: { type: string; payload: Record<string, unknown>; created_at: string }[];
  invoices: { id: string; number: string; status: "open" | "paid" | "void"; total_xaf: number; issued_at: string; paid_at: string | null }[];
};

export const STATUS_FILTERS = ["all", "trialing", "active", "past_due", "read_only", "suspended"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
