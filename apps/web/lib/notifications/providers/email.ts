import { randomUUID } from "node:crypto";
import type { EmailProvider } from "./types";

/** Adresse masquée pour les journaux. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}…@${domain}`;
}

/**
 * `console` (développement, tests) : rien n'est envoyé. L'objet est affiché dans le terminal, et le texte en local
 * (`log` n'écrit qu'hors production ou avec NOTIFY_LOG=1) pour lire le code de vérification sans boîte mail.
 */
export function consoleEmail(log: (line: string) => void = () => undefined): EmailProvider {
  return {
    name: "console",
    async send(to, subject, text) {
      log(`[email:console] ${maskEmail(to)} « ${subject} »\n${text}`);
      return { ok: true, messageId: `console.${randomUUID()}` };
    },
  };
}

export type SmtpConfig = {
  host: string;
  port: number;
  /** TLS dès la connexion (port 465) ; sinon STARTTLS (587). */
  secure: boolean;
  user: string;
  password: string;
  /** Expéditeur, ex. « NextIn <no-reply@votre-domaine> » (domaine vérifié chez le fournisseur). */
  from: string;
  replyTo?: string;
};

/**
 * Configuration SMTP lue dans l'environnement (Brevo : smtp-relay.brevo.com:587 ; Resend : smtp.resend.com:465,
 * utilisateur « resend »). Renvoie les variables manquantes plutôt qu'une configuration partielle.
 */
export function smtpConfigFromEnv(env: Record<string, string | undefined>): { config: SmtpConfig | null; missing: string[] } {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"] as const;
  const missing = required.filter((k) => !env[k]?.trim());
  if (missing.length) return { config: null, missing };
  const port = Number(env.SMTP_PORT || 587);
  return {
    config: {
      host: env.SMTP_HOST!.trim(),
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" || env.SMTP_SECURE === "1" : port === 465,
      user: env.SMTP_USER!.trim(),
      password: env.SMTP_PASSWORD!,
      from: env.EMAIL_FROM!.trim(),
      replyTo: env.EMAIL_REPLY_TO?.trim() || undefined,
    },
    missing: [],
  };
}

/** Erreurs SMTP permanentes (5xx : adresse refusée, domaine inconnu) : pas de nouvel essai. */
function permanent(error: unknown): boolean {
  const code = (error as { responseCode?: number }).responseCode;
  return typeof code === "number" && code >= 500 && code < 600;
}

/** Envoi par un fournisseur SMTP (Brevo, Resend…) ; nodemailer chargé seulement s'il sert. */
export function smtpEmail(config: SmtpConfig, log: (line: string) => void = () => undefined): EmailProvider {
  let transport: Promise<import("nodemailer").Transporter> | null = null;
  const getTransport = () =>
    (transport ??= import("nodemailer").then((m) =>
      m.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.password },
        requireTLS: !config.secure,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    ));
  return {
    name: "smtp",
    async send(to, subject, text, html) {
      try {
        const info = await (await getTransport()).sendMail({ from: config.from, replyTo: config.replyTo, to, subject, text, html });
        log(`[email:smtp] ${maskEmail(to)} « ${subject} » ${info.messageId}`);
        return { ok: true, messageId: info.messageId };
      } catch (e) {
        const message = (e as Error).message.slice(0, 200);
        return { ok: false, retryable: !permanent(e), error: `smtp: ${message}` };
      }
    },
  };
}
