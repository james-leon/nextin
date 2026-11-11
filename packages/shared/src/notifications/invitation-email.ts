/**
 * E-mail d'invitation du personnel (P1 : responsable invité depuis la console Wintek ; P2 : invitations de
 * l'établissement). Une seule action : « Accepter l'invitation ». Jamais le jeton ailleurs que dans le lien.
 */
import { renderEmail, type EmailContent } from "./email";
import type { NotifLocale } from "./opt-in";

export type InvitationRole = "org_admin" | "branch_manager" | "receptionist" | "agent" | "cashier";

const ROLES: Record<NotifLocale, Record<InvitationRole, string>> = {
  fr: {
    org_admin: "administrateur",
    branch_manager: "responsable d'agence",
    receptionist: "réceptionniste",
    agent: "agent / praticien",
    cashier: "caissier",
  },
  en: {
    org_admin: "administrator",
    branch_manager: "branch manager",
    receptionist: "receptionist",
    agent: "agent / practitioner",
    cashier: "cashier",
  },
};

const FOOTER: Record<NotifLocale, string> = {
  fr: "Vous recevez ce message parce qu'un compte NextIn a été préparé pour vous. Si vous ne vous attendiez pas à cette invitation, ignorez cet e-mail : rien ne sera créé. NextIn par Wintek.",
  en: "You are receiving this message because a NextIn account was prepared for you. If you were not expecting this invitation, ignore this email: nothing will be created. NextIn by Wintek.",
};

export type InvitationEmailData = {
  organization: string;
  role: InvitationRole;
  /** Lien absolu (`absoluteUrl('/invite/<jeton>')`). */
  link: string;
  /** Validité du lien, en jours. */
  validDays: number;
  /** Invitation préparée par Wintek (responsable d'un nouvel établissement). */
  byWintek?: boolean;
};

export function invitationEmail(locale: NotifLocale, d: InvitationEmailData): EmailContent {
  const fr = locale === "fr";
  const role = ROLES[locale][d.role];
  return renderEmail(
    {
      subject: fr ? `Invitation à rejoindre ${d.organization} sur NextIn` : `Invitation to join ${d.organization} on NextIn`,
      preheader: fr ? `Rôle : ${role}` : `Role: ${role}`,
      title: fr ? `Rejoignez ${d.organization}` : `Join ${d.organization}`,
      intro: d.byWintek
        ? fr
          ? `Wintek a créé l'espace NextIn de ${d.organization}. Vous en êtes l'${role} : acceptez l'invitation pour créer votre compte et terminer la configuration.`
          : `Wintek has set up the NextIn space for ${d.organization}. You are its ${role}: accept the invitation to create your account and finish the setup.`
        : fr
          ? `Vous êtes invité à rejoindre ${d.organization} sur NextIn en tant que ${role}.`
          : `You are invited to join ${d.organization} on NextIn as ${role}.`,
      notes: [
        fr
          ? `Ce lien est personnel et valable ${d.validDays} jours. Ne le transférez pas.`
          : `This link is personal and valid for ${d.validDays} days. Do not forward it.`,
      ],
      action: { label: fr ? "Accepter l'invitation" : "Accept the invitation", href: d.link },
    },
    locale,
    FOOTER[locale],
  );
}
