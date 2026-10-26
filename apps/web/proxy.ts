import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Espaces réservés au personnel : session rafraîchie et utilisateur non anonyme exigé.
 * Les pages client publiques (/q, /t, /c…) ne passent pas par ici pour rester légères.
 */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isStaff = !!claims && claims.is_anonymous !== true;

  // Déjà connecté : pas de passage par la connexion ou l'inscription.
  if (isStaff && (path === "/login" || path === "/signup")) {
    const target = request.nextUrl.clone();
    target.pathname = "/app";
    target.search = "";
    return NextResponse.redirect(target);
  }

  const isStaffArea = /^\/(app|desk|admin|ads)(\/|$)/.test(path);
  if (isStaffArea && !isStaff) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/desk/:path*", "/admin/:path*", "/ads/:path*", "/login", "/signup", "/invite/:path*", "/auth/:path*"],
};
