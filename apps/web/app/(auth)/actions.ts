"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { absoluteUrl, safeNextPath } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import { loginCodeRequestSchema, loginCodeVerifySchema, loginSchema, resetPasswordSchema, signupSchema } from "@nextin/shared/schemas";
import { fieldErrorsFrom, mapAuthError, type ActionResult } from "@/lib/auth/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { recordLoginFailure, recordStaffLogin } from "@/lib/auth/login-security";
import { SESSION_ONLY_COOKIE } from "@/lib/auth/session-cookies";

const KNOWN = Object.keys(messages.fr.errors);

function form(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of data.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

function captcha(token: string | undefined) {
  return token ? { captchaToken: token } : {};
}

export async function signInWithPassword(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(form(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { email, password, next, captchaToken } = parsed.data;
  // « Se souvenir de moi » décoché : cookies de session (déconnexion à la fermeture du navigateur).
  const remember = data.get("remember") === "on";
  const cookieStore = await cookies();
  if (remember) cookieStore.delete(SESSION_ONLY_COOKIE);
  else cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  const supabase = await getSupabaseServerClient({ sessionOnly: !remember });
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: captcha(captchaToken) });
  if (error) {
    // Mauvais identifiants : comptés pour l'alerte « 10 échecs en 15 minutes » (S3).
    if (error.code === "invalid_credentials") await recordLoginFailure(email);
    return { ok: false, error: mapAuthError(error) };
  }
  await recordStaffLogin(supabase);
  redirect(safeNextPath(next));
}

export async function requestLoginCode(
  _prev: ActionResult<{ email?: string }> | null,
  data: FormData,
): Promise<ActionResult<{ email?: string }>> {
  const parsed = loginCodeRequestSchema.safeParse(form(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const supabase = await getSupabaseServerClient();
  // Pas de création de compte par ce biais : les comptes se créent via /signup.
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, ...captcha(parsed.data.captchaToken) },
  });
  // Un e-mail inconnu n'est pas révélé : la réponse est identique.
  if (error && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    return { ok: false, error: mapAuthError(error) };
  }
  return { ok: true, email: parsed.data.email };
}

export async function verifyLoginCode(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const parsed = loginCodeVerifySchema.safeParse(form(data));
  if (!parsed.success) return { ok: false, error: "code_invalid", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: "email" });
  if (error) {
    await recordLoginFailure(parsed.data.email);
    return { ok: false, error: mapAuthError(error) === "generic" ? "code_invalid" : mapAuthError(error) };
  }
  await recordStaffLogin(supabase);
  redirect(safeNextPath(parsed.data.next));
}

export async function signUp(
  _prev: ActionResult<{ checkEmail?: string }> | null,
  data: FormData,
): Promise<ActionResult<{ checkEmail?: string }>> {
  const parsed = signupSchema.safeParse(form(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const { fullName, email, password, next, captchaToken } = parsed.data;
  const target = safeNextPath(next);
  const supabase = await getSupabaseServerClient();
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, locale: data.get("locale") === "en" ? "en" : "fr" },
      emailRedirectTo: absoluteUrl(`/auth/confirm?next=${encodeURIComponent(target)}`),
      ...captcha(captchaToken),
    },
  });
  if (error) return { ok: false, error: mapAuthError(error) };
  // Adresse déjà utilisée : Supabase renvoie un utilisateur sans identité, sans révéler l'existence du compte.
  if (result.user && result.user.identities?.length === 0) return { ok: false, error: "user_already_exists" };
  if (!result.session) return { ok: true, checkEmail: email };
  redirect(target);
}

/** Nouveau mot de passe d'un compte connecté (parcours « Mot de passe oublié ? » : connexion par code, puis ici). */
export async function resetPassword(_prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(form(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.is_anonymous) redirect("/login?next=%2Freset-password");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  // Même mot de passe qu'avant : Supabase refuse (same_password), message dédié du dictionnaire si connu.
  if (error) return { ok: false, error: mapAuthError(error) };
  redirect(safeNextPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  redirect("/login");
}
