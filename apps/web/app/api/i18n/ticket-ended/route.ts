import { getLocale, getMessages } from "next-intl/server";

/**
 * Textes d'un ticket fini (terminé, annulé, clôturé) et de la note, chargés quand un ticket en cours se termine
 * pendant que « Mon ticket » est ouvert : ils ne pèsent pas sur le premier chargement de la page (budget < 200 Ko).
 */
export async function GET() {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  return Response.json({ locale, ticketEnded: m.client.ticketEnded }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
