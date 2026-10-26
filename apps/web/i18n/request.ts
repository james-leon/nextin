import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, messages } from "@nextin/shared/i18n";

/** Langue sans préfixe d'URL : cookie explicite, sinon Accept-Language, sinon français. */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : localeFromAcceptLanguage((await headers()).get("accept-language"));
  return { locale, messages: messages[locale], timeZone: "Africa/Douala" };
});
