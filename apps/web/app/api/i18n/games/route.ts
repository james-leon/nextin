import { getLocale, getMessages } from "next-intl/server";

/**
 * Textes des jeux (M10b), chargés à l'ouverture de la feuille « Jouer en attendant » : ils ne pèsent pas sur le
 * premier chargement de « Mon ticket » (budget < 200 Ko). Langue du cookie, comme les pages.
 */
export async function GET() {
  const [locale, m] = await Promise.all([getLocale(), getMessages()]);
  return Response.json({ locale, games: m.games }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
