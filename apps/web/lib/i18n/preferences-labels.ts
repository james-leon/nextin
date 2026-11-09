import "server-only";
import { getTranslations } from "next-intl/server";
import type { PreferencesLabels } from "@/components/settings/preferences";

/** Textes du composant Préférences, traduits côté serveur. */
export async function preferencesLabels(appearanceFooter?: string): Promise<PreferencesLabels> {
  const tt = await getTranslations("theme");
  const tc = await getTranslations("common");
  return {
    appearance: tt("label"),
    auto: tt("auto"),
    light: tt("light"),
    dark: tt("dark"),
    appearanceFooter,
    language: tc("language"),
    french: tc("french"),
    english: tc("english"),
  };
}
