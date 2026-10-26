import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Espaces réservés au personnel : session rafraîchie et utilisateur non anonyme exigé.
 * Les pages client publiques (/q, /t, /c…) ne passent pas par ici pour rester légères.
 */
export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const isStaffArea = /^\/(app|desk|admin|ads)(\/|$)/.test(request.nextUrl.pathname);
  if (isStaffArea && (!claims || claims.is_anonymous === true)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/desk/:path*", "/admin/:path*", "/ads/:path*", "/login", "/auth/:path*"],
};
