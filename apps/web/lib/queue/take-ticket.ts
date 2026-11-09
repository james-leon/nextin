import { absoluteUrl } from "@nextin/shared";
import { queueErrorCode, queueErrorStatus } from "@nextin/shared/queue";
import { takeTicketSchema, type TakeTicketInput } from "@nextin/shared/schemas";
import type { ErrorCode } from "@/lib/auth/errors";
import type { TurnstileResult } from "@/lib/security/turnstile";

type RpcError = { code?: string; message?: string; details?: string | null };

export type TakeTicketDeps = {
  /** Utilisateur de la session (anonyme pour un client), ou null. */
  userId: string | null;
  /** Empreinte salée de l'IP du client, ou null si inconnue. */
  ipHash: string | null;
  verifyCaptcha: (token: string | undefined) => Promise<TurnstileResult>;
  /** Transaction séparée : les tentatives refusées sont comptées. */
  throttle: (userId: string, ipHash: string | null) => Promise<boolean>;
  take: (userId: string, input: TakeTicketInput) => Promise<{ data: unknown; error: RpcError | null }>;
  env?: Record<string, string | undefined>;
};

export type TakeTicketResponse =
  | { status: 201; body: { ok: true; ticket: { publicToken: string; displayCode: string; url: string } } }
  | { status: number; body: { ok: false; error: ErrorCode; ticketUrl?: string } };

const fail = (status: number, error: ErrorCode, ticketUrl?: string): TakeTicketResponse => ({
  status,
  body: ticketUrl ? { ok: false, error, ticketUrl } : { ok: false, error },
});

const TOKEN = /^[A-Za-z0-9]{22}$/;

/**
 * Prise de ticket d'un client : Zod → session → limitation → captcha → RPC `take_ticket` (service role).
 * Un client qui a déjà un ticket actif dans l'agence reçoit le lien de ce ticket.
 */
export async function handleTakeTicket(payload: unknown, deps: TakeTicketDeps): Promise<TakeTicketResponse> {
  const parsed = takeTicketSchema.safeParse(payload);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message === "invalid_entry" ? "invalid_entry" : "generic";
    return fail(400, code);
  }
  if (!deps.userId) return fail(401, "not_allowed");
  if (!(await deps.throttle(deps.userId, deps.ipHash))) return fail(429, "rate_limited");

  const captcha = await deps.verifyCaptcha(parsed.data.captchaToken);
  if (!captcha.ok) return fail(400, "captcha_failed");

  const { data, error } = await deps.take(deps.userId, parsed.data);
  if (error) {
    const code = queueErrorCode(error);
    if (!code) return fail(500, "generic");
    const existing = code === "active_ticket_exists" && error.details && TOKEN.test(error.details) ? error.details : undefined;
    return fail(queueErrorStatus(code), code, existing ? absoluteUrl(`/t/${existing}`, deps.env) : undefined);
  }
  const ticket = data as { public_token: string; display_code: string };
  return {
    status: 201,
    body: {
      ok: true,
      ticket: { publicToken: ticket.public_token, displayCode: ticket.display_code, url: absoluteUrl(`/t/${ticket.public_token}`, deps.env) },
    },
  };
}
