"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { maskPhone, randomSlugSuffix, slugWithSuffix, slugify } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import { phoneCodeRequestSchema, phoneCodeVerifySchema, selfServiceSignupSchema } from "@nextin/shared/schemas";
import { mapDbError } from "@/lib/admin/db-errors";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { clientIp } from "@/lib/security/ip";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = Object.keys(messages.fr.errors);
const MAX_SLUG_ATTEMPTS = 6;

/**
 * Inscription d'un établissement (M10a, §11.1) en trois étapes : téléphone du directeur (code WhatsApp, SMS en secours),
 * code, puis établissement. Un seul essai gratuit par numéro, vérifié par la base.
 */
export async function requestSignupCode(
  _prev: ActionResult<{ verificationId: string; phoneMasked: string }> | null,
  data: FormData,
): Promise<ActionResult<{ verificationId: string; phoneMasked: string }>> {
  const session = await requireStaffSession("/app/new");
  const parsed = phoneCodeRequestSchema.safeParse({
    phone: data.get("phone"),
    locale: data.get("locale") || undefined,
    captchaToken: data.get("captchaToken") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "phone_invalid", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };

  const captcha = await verifyCaptchaToken(parsed.data.captchaToken, {
    remoteIp: clientIp(await headers()) ?? undefined,
    expectedAction: "signup_phone",
  });
  if (!captcha.ok) return { ok: false, error: "captcha_failed" };

  // Envoi par le serveur seulement (captcha vérifié) : la RPC n'est pas exposée aux sessions.
  const { data: verificationId, error } = await getSupabaseAdminClient().rpc("request_phone_code", {
    p_user: session.userId,
    p_phone: parsed.data.phone,
    p_locale: parsed.data.locale,
  });
  if (error || !verificationId) return { ok: false, error: mapDbError(error) };
  return { ok: true, verificationId, phoneMasked: maskPhone(parsed.data.phone) };
}

export async function verifySignupCode(
  _prev: ActionResult | null,
  data: FormData,
): Promise<ActionResult> {
  await requireStaffSession("/app/new");
  const parsed = phoneCodeVerifySchema.safeParse({ verificationId: data.get("verificationId"), code: data.get("code") });
  if (!parsed.success) return { ok: false, error: "code_invalid", fieldErrors: { code: "code_invalid" } };
  const supabase = await getSupabaseServerClient();
  const { data: result, error } = await supabase.rpc("verify_phone_code", {
    p_verification: parsed.data.verificationId,
    p_code: parsed.data.code,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  const r = result as { verified?: boolean };
  if (!r.verified) return { ok: false, error: "code_invalid", fieldErrors: { code: "code_invalid" } };
  return { ok: true };
}

export async function createOrganization(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  await requireStaffSession("/app/new");
  const parsed = selfServiceSignupSchema.safeParse({
    verificationId: data.get("verificationId"),
    name: data.get("name"),
    type: data.get("type") || undefined,
    defaultLocale: data.get("defaultLocale") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error, KNOWN);
    if (fieldErrors.type) fieldErrors.type = "type_required";
    if (fieldErrors.verificationId) return { ok: false, error: "phone_not_verified" };
    return { ok: false, error: "generic", fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const base = slugify(parsed.data.name);
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    // Collision : suffixe aléatoire (inépuisable, contrairement à -2, -3…).
    const slug = attempt === 1 ? base : slugWithSuffix(base, randomSlugSuffix());
    const { data: result, error } = await supabase.rpc("self_service_signup", {
      p_name: parsed.data.name,
      p_slug: slug,
      p_type: parsed.data.type,
      p_default_locale: parsed.data.defaultLocale,
      p_verification: parsed.data.verificationId,
    });
    if (!error) {
      const { organization_id: orgId, trial } = result as { organization_id: string; trial: boolean };
      // Assistant de démarrage (§11.3), ou paiement directement si le numéro a déjà servi à un essai.
      redirect(trial ? `/app/o/${orgId}/setup?welcome=1` : `/app/o/${orgId}/billing?no_trial=1`);
    }
    if (error.code === "23505") continue; // identifiant déjà pris : suffixe suivant
    if (error.code === "42501") redirect("/login?next=%2Fapp%2Fnew");
    return { ok: false, error: mapDbError(error) };
  }
  return { ok: false, error: "generic" };
}
