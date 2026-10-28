import "server-only";
import { YOUR_TURN_SMS_GUARD_SECONDS, retryDelaySeconds } from "@nextin/shared/notifications";
import type { Json } from "@nextin/shared/database";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recheckPendingPayments } from "@/lib/payments/service";
import { sendAccountMessage, type ClaimedAccountMessage } from "./account";
import { getProviders, type Providers } from "./providers";
import { sendJob, type ClaimedJob, type Outcome } from "./send";

type Admin = ReturnType<typeof getSupabaseAdminClient>;

async function processJob(admin: Admin, providers: Providers, job: ClaimedJob) {
  let outcome: Outcome;
  try {
    outcome = await sendJob(job, providers, (contact) => admin.rpc("disable_push_contact", { p_contact: contact }));
  } catch (e) {
    outcome = { status: "failed", error: (e as Error).message, retryIn: retryDelaySeconds(job.attempt) };
  }
  await admin.rpc("complete_notification_job", {
    p_job: job.id,
    p_status: outcome.status,
    p_provider_message_id: outcome.messageId ?? (null as unknown as string),
    p_error: outcome.error ?? (null as unknown as string),
    p_retry_in_seconds: outcome.retryIn ?? (null as unknown as number),
    p_template_name: outcome.template ?? (null as unknown as string),
    p_payload: (outcome.text ? { text: outcome.text } : null) as unknown as Json,
  });
  if (job.channel !== "whatsapp") return;
  if (outcome.status === "sent" && job.event === "your_turn") {
    // « C'est votre tour » : SMS de secours si WhatsApp n'accuse pas réception dans les 2 minutes.
    await admin.rpc("schedule_sms_fallback", { p_job: job.id, p_delay_seconds: YOUR_TURN_SMS_GUARD_SECONDS, p_guard: true });
  } else if (outcome.status === "failed" && outcome.retryIn == null) {
    await admin.rpc("schedule_sms_fallback", { p_job: job.id, p_delay_seconds: 0, p_guard: false });
  }
}

async function processAccountMessage(admin: Admin, providers: Providers, m: ClaimedAccountMessage) {
  let result;
  try {
    result = await sendAccountMessage(m, providers);
  } catch (e) {
    result = { status: "failed" as const, error: (e as Error).message, retryIn: m.attempt < 3 ? retryDelaySeconds(m.attempt) : null };
  }
  await admin.rpc("complete_account_message", {
    p_message: m.id,
    p_status: result.status,
    p_error: result.error ?? (null as unknown as string),
    p_retry_in_seconds: result.retryIn ?? (null as unknown as number),
  });
}

let running: Promise<number> | null = null;

/**
 * Envoie les messages dus, par lots de 20, dans la limite de `budgetMs`. Un seul passage à la fois par processus ;
 * entre processus, `claim_notification_jobs` (FOR UPDATE SKIP LOCKED) empêche tout double envoi.
 */
export function dispatchNotifications(options: { budgetMs?: number; providers?: Providers } = {}): Promise<number> {
  running ??= (async () => {
    const admin = getSupabaseAdminClient();
    const providers = options.providers ?? getProviders();
    const started = Date.now();
    let processed = 0;
    try {
      while (Date.now() - started < (options.budgetMs ?? 8_000)) {
        const { data, error } = await admin.rpc("claim_notification_jobs", { p_limit: 20 });
        if (error) throw new Error(`claim_notification_jobs: ${error.message}`);
        const jobs = (data ?? []) as unknown as ClaimedJob[];
        if (!jobs.length) break;
        await Promise.all(jobs.map((job) => processJob(admin, providers, job)));
        processed += jobs.length;
      }
      // Messages du compte (M10a) : code de vérification, rappels d'abonnement, reçus, alertes de quota.
      while (Date.now() - started < (options.budgetMs ?? 8_000)) {
        const { data, error } = await admin.rpc("claim_account_messages", { p_limit: 20 });
        if (error) throw new Error(`claim_account_messages: ${error.message}`);
        const batch = (data ?? []) as unknown as ClaimedAccountMessage[];
        if (!batch.length) break;
        await Promise.all(batch.map((m) => processAccountMessage(admin, providers, m)));
        processed += batch.length;
      }
      // Rattrapage des paiements dont le webhook n'est pas arrivé (§11.5).
      await recheckPendingPayments(admin).catch((e: unknown) => console.error("[payments] recheck", e instanceof Error ? e.message : e));
      return processed;
    } finally {
      running = null;
    }
  })();
  return running;
}
