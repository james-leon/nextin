/**
 * « Se souvenir de moi » décoché : la session du personnel ne survit pas à la fermeture du navigateur.
 * Les cookies Supabase deviennent des cookies de session (sans date d'expiration), et ce repère — lui-même cookie
 * de session — demande au proxy de garder ce comportement à chaque rafraîchissement du jeton.
 */
export const SESSION_ONLY_COOKIE = "nextin_session_only";

type CookieOptions = { maxAge?: number; expires?: Date | string | number } & Record<string, unknown>;

/** Options d'un cookie de session : sans `maxAge` ni `expires` (sauf suppression, `maxAge: 0`). */
export function sessionOnly<T extends CookieOptions>(options: T | undefined, enabled: boolean): T | undefined {
  if (!enabled || !options || options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
