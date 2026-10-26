import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-public";

/**
 * Session anonyme du client (Supabase Auth), gardée dans le navigateur.
 * Elle identifie l'appareil pour la règle « un ticket actif par agence » et la limitation des demandes ;
 * elle n'est liée à aucune donnée personnelle.
 */
type StoredSession = { access_token: string; refresh_token: string; expires_at: number };

const KEY = "nextin-session";

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function write(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible (navigation privée) : la session vaut pour la page.
  }
}

let memory: StoredSession | null = null;

async function auth(path: string, body: Record<string, unknown>): Promise<StoredSession | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number };
    if (!json.access_token || !json.refresh_token) return null;
    const expiresAt = json.expires_at ?? Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600);
    return { access_token: json.access_token, refresh_token: json.refresh_token, expires_at: expiresAt };
  } catch {
    return null;
  }
}

/** Une session est-elle déjà présente (sinon la création demandera un jeton captcha) ? */
export function hasAnonSession(): boolean {
  return !!(memory ?? read());
}

/**
 * Jeton d'accès valide : session existante, rafraîchie si besoin, sinon nouvelle session anonyme
 * (avec le jeton captcha si Turnstile est actif). Null en cas d'échec (réseau, captcha).
 */
export async function getAnonAccessToken(captchaToken?: string): Promise<string | null> {
  const current = memory ?? read();
  const now = Math.floor(Date.now() / 1000);
  if (current && current.expires_at - 60 > now) return current.access_token;
  let next = current ? await auth("token?grant_type=refresh_token", { refresh_token: current.refresh_token }) : null;
  if (!next && (!current || captchaToken !== undefined)) {
    next = await auth("signup", { data: {}, ...(captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {}) });
  }
  memory = next;
  write(next);
  return next?.access_token ?? null;
}

/** Oublie la session (refusée par le serveur) : la prochaine demande en crée une nouvelle. */
export function clearAnonSession() {
  memory = null;
  write(null);
}
