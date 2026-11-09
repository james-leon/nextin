import "server-only";
import { absoluteUrl } from "@nextin/shared";
import { paymentProvider, type PaymentEvent, type PaymentProvider } from "@nextin/payments";
import { startPaymentSchema } from "@nextin/shared/schemas";
import type { ErrorCode } from "@/lib/auth/errors";
import { mapDbError } from "@/lib/admin/db-errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof getSupabaseAdminClient>;

let cached: PaymentProvider | null = null;
/** Fournisseur actif (`PAYMENT_PROVIDER`, faux par défaut) ; erreur explicite si sa configuration manque. */
export function activeProvider(): PaymentProvider {
  cached ??= paymentProvider(process.env);
  return cached;
}

/**
 * Début d'un paiement depuis `/pay/<jeton>` (captcha déjà vérifié) : paiement « en attente » en base, puis demande à
 * l'agrégateur (validation par code secret sur le téléphone, ou page hébergée).
 */
export async function startPayment(
  input: unknown,
  admin: Admin = getSupabaseAdminClient(),
): Promise<{ ok: true; externalId: string; redirectUrl: string | null } | { ok: false; error: ErrorCode; status: number }> {
  const parsed = startPaymentSchema.safeParse(input);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return { ok: false, error: field === "msisdn" ? "phone_invalid" : "generic", status: 422 };
  }
  const provider = activeProvider();
  const { data, error } = await admin.rpc("start_payment", {
    p_token: parsed.data.token,
    p_provider: provider.name,
    p_channel: parsed.data.channel,
    p_msisdn: parsed.data.msisdn,
  });
  if (error || !data) {
    const code = mapDbError(error);
    return { ok: false, error: code, status: code === "not_found" ? 404 : code === "rate_limited" ? 429 : 409 };
  }
  const started = data as { external_id: string; amount_xaf: number; description: string };
  try {
    const checkout = await provider.createCheckout({
      externalId: started.external_id,
      amountXaf: started.amount_xaf,
      channel: parsed.data.channel,
      msisdn: parsed.data.msisdn,
      description: started.description,
      callbackUrl: absoluteUrl(`/api/payments/webhook/${provider.name}`),
      returnUrl: absoluteUrl(`/pay/${parsed.data.token}`),
    });
    await admin.rpc("confirm_payment", {
      p_external_id: started.external_id,
      p_status: checkout.status,
      p_provider_ref: checkout.providerRef ?? undefined,
    });
    return { ok: true, externalId: started.external_id, redirectUrl: checkout.redirectUrl };
  } catch (e) {
    await admin.rpc("confirm_payment", { p_external_id: started.external_id, p_status: "failed", p_failure: "provider_error" });
    console.error("[payments] createCheckout failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "payment_failed", status: 502 };
  }
}

/** Applique un statut confirmé par le fournisseur (idempotent côté base). */
export async function applyEvent(event: PaymentEvent, admin: Admin = getSupabaseAdminClient()) {
  if (event.status === "pending") return;
  const { error } = await admin.rpc("confirm_payment", {
    p_external_id: event.externalId,
    p_status: event.status,
    p_provider_ref: event.providerRef ?? undefined,
    p_failure: event.failureReason ?? undefined,
  });
  if (error && mapDbError(error) !== "not_found") throw new Error(`confirm_payment: ${error.message}`);
}

/** Revérifie un paiement encore en attente auprès du fournisseur (page de paiement, rattrapage). */
export async function refreshPayment(externalId: string, providerRef: string | null, admin: Admin = getSupabaseAdminClient()) {
  const event = await activeProvider().fetchStatus(externalId, providerRef);
  await applyEvent(event, admin);
  return event.status;
}

/** Rattrapage (§11.5) : paiements en attente depuis plus de 10 minutes (webhook perdu). */
export async function recheckPendingPayments(admin: Admin = getSupabaseAdminClient()): Promise<number> {
  const { data } = await admin.rpc("payments_to_recheck", { p_limit: 20 });
  let done = 0;
  for (const p of data ?? []) {
    if (p.provider !== activeProvider().name) continue;
    try {
      await refreshPayment(p.external_id, p.provider_ref, admin);
      done++;
    } catch (e) {
      console.error("[payments] recheck failed", e instanceof Error ? e.message : e);
    }
  }
  return done;
}
