"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomSlugSuffix, slugWithSuffix, slugify } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import { newOrganizationFormSchema } from "@nextin/shared/schemas";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { requireStaffSession } from "@/lib/auth/session";
import { verifyCaptchaToken } from "@/lib/security/captcha";
import { clientIp } from "@/lib/security/ip";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = Object.keys(messages.fr.errors);
const MAX_SLUG_ATTEMPTS = 6;

export async function createOrganization(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  await requireStaffSession("/app/new");
  const parsed = newOrganizationFormSchema.safeParse({
    name: data.get("name"),
    type: data.get("type") || undefined,
    defaultLocale: data.get("defaultLocale") || undefined,
    captchaToken: data.get("captchaToken") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error, KNOWN);
    if (fieldErrors.type) fieldErrors.type = "type_required";
    return { ok: false, error: "generic", fieldErrors };
  }

  const captcha = await verifyCaptchaToken(parsed.data.captchaToken, {
    remoteIp: clientIp(await headers()) ?? undefined,
    expectedAction: "create_organization",
  });
  if (!captcha.ok) return { ok: false, error: "captcha_failed" };

  const supabase = await getSupabaseServerClient();
  const base = slugify(parsed.data.name);
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    // Collision : suffixe aléatoire (inépuisable, contrairement à -2, -3…).
    const slug = attempt === 1 ? base : slugWithSuffix(base, randomSlugSuffix());
    const { data: orgId, error } = await supabase.rpc("create_organization", {
      p_name: parsed.data.name,
      p_slug: slug,
      p_type: parsed.data.type,
      p_default_locale: parsed.data.defaultLocale,
    });
    if (!error) redirect(`/app?created=${orgId}`);
    if (error.code === "23505") continue; // identifiant déjà pris : suffixe suivant
    if (error.code === "P0429") return { ok: false, error: "too_many_organizations" };
    if (error.code === "42501") redirect("/login?next=%2Fapp%2Fnew");
    return { ok: false, error: "generic" };
  }
  return { ok: false, error: "generic" };
}
