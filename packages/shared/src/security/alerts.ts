/**
 * Alertes de sécurité par e-mail (S3) : objet et texte FR/EN. Jamais de donnée d'un client de l'établissement ;
 * le compte est désigné par son adresse masquée, l'appareil par son navigateur.
 */
export const SECURITY_ALERT_KINDS = ["admin_new_device", "login_failures", "mfa_disabled", "admin_role_granted", "mass_export"] as const;
export type SecurityAlertKind = (typeof SECURITY_ALERT_KINDS)[number];
type Locale = "fr" | "en";

export type SecurityAlertDetail = {
  device?: string;
  account?: string;
  failures?: number;
  window_minutes?: number;
  by?: string;
  organization?: string;
  from?: string;
  to?: string;
  kind?: string;
  at?: string;
};

const SIGNATURE: Record<Locale, string> = {
  fr: "Si vous n'êtes pas à l'origine de cette action, changez votre mot de passe et prévenez le support Wintek : contact@wintekservices.com.\n\n— NextIn par Wintek",
  en: "If you did not do this, change your password and contact Wintek support: contact@wintekservices.com.\n\n— NextIn by Wintek",
};

const TEXTS: Record<Locale, Record<SecurityAlertKind, (d: SecurityAlertDetail) => { subject: string; body: string }>> = {
  fr: {
    admin_new_device: (d) => ({
      subject: "NextIn : connexion depuis un nouvel appareil",
      body: `Un compte administrateur vient de se connecter depuis un appareil inconnu${d.device ? ` (${d.device})` : ""}.`,
    }),
    login_failures: (d) => ({
      subject: "NextIn : tentatives de connexion répétées",
      body: `${d.failures ?? 10} tentatives de connexion ont échoué en ${d.window_minutes ?? 15} minutes sur le compte ${d.account ?? ""}.`,
    }),
    mfa_disabled: (d) => ({
      subject: "NextIn : double authentification désactivée",
      body:
        d.by === "admin"
          ? "La double authentification de votre compte a été réinitialisée par le support Wintek. Configurez un nouveau code à votre prochaine connexion."
          : "La double authentification de votre compte vient d'être désactivée.",
    }),
    admin_role_granted: (d) => ({
      subject: "NextIn : nouvel administrateur",
      body: `Un compte vient de recevoir le rôle d'administrateur de l'établissement ${d.organization ?? ""}.`,
    }),
    mass_export: (d) => ({
      subject: "NextIn : export massif de statistiques",
      body: `Un export important des statistiques de ${d.organization ?? "l'établissement"} vient d'être fait (du ${d.from ?? ""} au ${d.to ?? ""}).`,
    }),
  },
  en: {
    admin_new_device: (d) => ({
      subject: "NextIn: sign-in from a new device",
      body: `An administrator account just signed in from an unknown device${d.device ? ` (${d.device})` : ""}.`,
    }),
    login_failures: (d) => ({
      subject: "NextIn: repeated sign-in attempts",
      body: `${d.failures ?? 10} sign-in attempts failed within ${d.window_minutes ?? 15} minutes on the account ${d.account ?? ""}.`,
    }),
    mfa_disabled: (d) => ({
      subject: "NextIn: two-factor authentication turned off",
      body:
        d.by === "admin"
          ? "Your account's two-factor authentication was reset by Wintek support. Set up a new code at your next sign-in."
          : "Two-factor authentication was just turned off on your account.",
    }),
    admin_role_granted: (d) => ({
      subject: "NextIn: new administrator",
      body: `An account was just given the administrator role of ${d.organization ?? "the organization"}.`,
    }),
    mass_export: (d) => ({
      subject: "NextIn: large statistics export",
      body: `A large export of ${d.organization ?? "the organization"}'s statistics was just made (from ${d.from ?? ""} to ${d.to ?? ""}).`,
    }),
  },
};

export function isSecurityAlertKind(kind: string): kind is SecurityAlertKind {
  return (SECURITY_ALERT_KINDS as readonly string[]).includes(kind);
}

export function securityAlertEmail(kind: SecurityAlertKind, locale: Locale, detail: SecurityAlertDetail): { subject: string; text: string } {
  const { subject, body } = TEXTS[locale][kind](detail);
  return { subject, text: `${body}\n\n${SIGNATURE[locale]}` };
}

/** Description courte d'un appareil d'après son agent utilisateur (« Chrome · Windows ») : jamais l'agent complet. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navigateur";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}
