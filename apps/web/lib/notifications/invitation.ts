import "server-only";
import { absoluteUrl } from "@nextin/shared";
import { invitationEmail, type InvitationRole } from "@nextin/shared/notifications";
import { getProviders } from "./providers";

/**
 * Envoi immédiat d'une invitation du personnel (P1, P2) : le jeton n'existe en clair que le temps de cet appel.
 * Renvoie le lien seulement si l'e-mail n'est pas parti (à transmettre à la main, une seule fois).
 */
export async function sendInvitationEmail(input: {
  to: string;
  token: string;
  organization: string;
  role: InvitationRole;
  locale: string | null | undefined;
  byWintek?: boolean;
}): Promise<{ mailSent: boolean; link: string }> {
  const link = absoluteUrl(`/invite/${input.token}`);
  const mail = invitationEmail(input.locale === "en" ? "en" : "fr", {
    organization: input.organization,
    role: input.role,
    link,
    validDays: 7,
    byWintek: input.byWintek,
  });
  try {
    const r = await getProviders().email.send(input.to, mail.subject, mail.text, mail.html);
    return { mailSent: r.ok, link };
  } catch {
    return { mailSent: false, link };
  }
}
