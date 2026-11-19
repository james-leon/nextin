import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PwaDebug, type PwaDebugLabels } from "@/components/pwa/pwa-debug";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("debugPwa");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Lecture à l'exécution (interrupteur sans nouveau build). */
function runtimeEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * /debug/pwa (LOT 5a E) — diagnostic de l'application installée, à ouvrir sur le téléphone qui affiche un écran blanc :
 * service worker (état, version), mode « écran d'accueil », caches et nombre d'entrées, dernière erreur enregistrée
 * sur l'appareil ; « Réinitialiser » désinstalle le service worker et vide les caches. Sans compte, non indexée, aucune
 * donnée personnelle.
 */
export default async function Page() {
  const [t, locale] = await Promise.all([getTranslations("debugPwa"), getLocale()]);
  const keys = [
    "title", "intro", "swSection", "state", "active", "installing", "none", "unsupported", "disabled", "version", "unknown",
    "appSection", "standalone", "yes", "no", "cachesSection", "noCaches", "entriesOne", "entriesOther", "errorSection",
    "noError", "reset", "resetting", "resetHint",
  ] as const;
  const labels = Object.fromEntries(keys.map((k) => [k, t(k)])) as PwaDebugLabels;
  return <PwaDebug labels={labels} locale={locale} enabled={runtimeEnv("NEXT_PUBLIC_SW_ENABLED") !== "false"} />;
}
