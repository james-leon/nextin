import { NextResponse, type NextRequest } from "next/server";
import { serverUsesHttps } from "@/lib/auth/session-cookies";
import { proxyClient, withCookies } from "@/lib/supabase/proxy";

/** Console Wintek (B5) : session fermée après 30 minutes sans requête. */
const ADMIN_IDLE_MS = 30 * 60 * 1000;
const ADMIN_SEEN_COOKIE = "nextin_admin_seen";

/**
 * Espaces réservés au personnel : session rafraîchie et utilisateur non anonyme exigé.
 * Les pages client publiques (/q, /t, /c…) ne passent pas par ici pour rester légères.
 *
 * Même vérification que `requireStaffSession` (auth.getUser, contrôlé par Supabase) : un jeton
 * aux claims valides mais refusé par le serveur (utilisateur supprimé ou recréé, session révoquée)
 * ne peut pas faire boucler /login ↔ /app. Une telle session est effacée localement.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = proxyClient(request);
  const path = request.nextUrl.pathname;
  const { data, error } = await supabase.auth.getUser();
  const isStaff = !!data.user && data.user.is_anonymous !== true;

  // Session refusée par Supabase (et non simple erreur réseau) : cookies effacés.
  if (!data.user && error && error.status !== undefined && error.status >= 400 && error.status < 500) {
    await supabase.auth.signOut({ scope: "local" });
  }

  // Déjà connecté : pas de passage par la connexion ou l'inscription.
  if (isStaff && (path === "/login" || path === "/signup")) {
    const target = request.nextUrl.clone();
    target.pathname = "/app";
    target.search = "";
    return withCookies(NextResponse.redirect(target), response());
  }

  const isStaffArea = /^\/(app|desk|admin|ads)(\/|$)/.test(path);
  if (isStaffArea && !isStaff) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return withCookies(NextResponse.redirect(login), response());
  }

  // Console Wintek : 30 minutes sans requête → déconnexion (B5). Chaque page ou action de la console relance le délai.
  if (isStaff && /^\/admin(\/|$)/.test(path)) {
    const seen = Number(request.cookies.get(ADMIN_SEEN_COOKIE)?.value ?? 0);
    if (seen > 0 && Date.now() - seen > ADMIN_IDLE_MS) {
      await supabase.auth.signOut({ scope: "local" });
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = `?next=%2Fadmin&error=session_expired`;
      const expired = withCookies(NextResponse.redirect(login), response());
      expired.cookies.delete(ADMIN_SEEN_COOKIE);
      return expired;
    }
    const res = response();
    res.cookies.set(ADMIN_SEEN_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", secure: serverUsesHttps(), path: "/", maxAge: 12 * 3600 });
    return res;
  }
  return response();
}

export const config = {
  matcher: ["/app/:path*", "/desk/:path*", "/admin/:path*", "/ads/:path*", "/login", "/signup", "/reset-password", "/mfa", "/invite/:path*", "/auth/:path*"],
};
