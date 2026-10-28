import { queueErrorCode, queueErrorStatus } from "@nextin/shared/queue";
import { appointmentRequestSchema, type AppointmentRequestInput } from "@nextin/shared/schemas";
import type { ErrorCode } from "@/lib/auth/errors";
import type { TurnstileResult } from "@/lib/security/turnstile";

type RpcError = { code?: string; message?: string; details?: string | null };

export type RequestDeps = {
  /** Utilisateur de la session (anonyme pour un patient), ou null. */
  userId: string | null;
  ipHash: string | null;
  verifyCaptcha: (token: string | undefined) => Promise<TurnstileResult>;
  /** Transaction séparée : les tentatives refusées sont comptées. */
  throttle: (userId: string, ipHash: string | null) => Promise<boolean>;
  create: (userId: string, input: AppointmentRequestInput) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

export type RequestResponse =
  | { status: 201; body: { ok: true; token: string } }
  | { status: number; body: { ok: false; error: ErrorCode } };

const fail = (status: number, error: ErrorCode): RequestResponse => ({ status, body: { ok: false, error } });
const FORM_ERRORS = new Set(["phone_invalid", "slot_required"]);

/**
 * Demande de rendez-vous d'un patient (M9) : Zod → session → limitation → captcha → RPC `create_appointment_request`
 * (service role). Le code de vérification part sur WhatsApp ; la page /r/<jeton> le fait saisir.
 */
export async function handleCreateRequest(payload: unknown, deps: RequestDeps): Promise<RequestResponse> {
  const parsed = appointmentRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "";
    return fail(400, (FORM_ERRORS.has(message) ? message : "generic") as ErrorCode);
  }
  if (!deps.userId) return fail(401, "not_allowed");
  if (!(await deps.throttle(deps.userId, deps.ipHash))) return fail(429, "rate_limited");
  const captcha = await deps.verifyCaptcha(parsed.data.captchaToken);
  if (!captcha.ok) return fail(400, "captcha_failed");

  const { data, error } = await deps.create(deps.userId, parsed.data);
  if (error) {
    const code = queueErrorCode(error);
    return code ? fail(queueErrorStatus(code), code) : fail(500, "generic");
  }
  return { status: 201, body: { ok: true, token: (data as { public_token: string }).public_token } };
}
