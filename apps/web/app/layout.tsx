import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { themeInitScript } from "@/components/theme/theme-init";
import { appleStartupFamily, startupImages, type StartupFamily } from "@/lib/pwa/startup-images";
import { splashCss, splashHtml } from "@/lib/pwa/splash";
import { clientErrorScript } from "@/lib/diagnostics/client-log";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NextIn", template: "%s · NextIn" },
  description: "Prenez un ticket virtuel et attendez où vous voulez.",
  applicationName: "NextIn",
  icons: {
    // Favicon : N seul (SVG pour les navigateurs récents, PNG 32 et 16 en repli). Icône iOS : dans le <head> ci-dessous.
    icon: [
      { url: "/brand/nextin-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
  },
};

/**
 * Balises de web app iOS, écrites dans le <head> du gabarit racine et non par l'API `metadata` :
 * - Next.js 16 n'émet pour `appleWebApp.capable` que `mobile-web-app-capable`, sans `apple-mobile-web-app-capable` ;
 *   sans cette balise Apple, iOS ignore les `apple-touch-startup-image` et ne traite pas complètement l'icône de
 *   l'écran d'accueil comme une web app ;
 * - les métadonnées d'une page qui attend des données (« Mon ticket ») sont parfois envoyées en fin de flux, dans le
 *   <body>, où Safari ne les lit pas. Le <head> du gabarit, lui, part toujours dans le premier envoi.
 * Écrans de démarrage (iPhone et iPad, `lib/pwa/startup-images.ts`) : seulement pour les navigateurs Apple, et pour leur
 * seule famille (iPhone : 24 balises, iPad : 18 ; budget des pages client).
 */
function AppleWebAppTags({ family, locale }: { family: StartupFamily | null; locale: string }) {
  // Composant synchrone : un composant asynchrone dans le <head> serait suspendu et envoyé en fin de flux.
  return (
    <>
      {/* Pas de liens automatiques sur les numéros, adresses e-mail masquées (« l•••@gmail.com ») ni adresses : iOS
          les soulignait. Écrit ici (et non par `metadata`) pour être lu par Safari à coup sûr. */}
      <meta name="format-detection" content="telephone=no, email=no, address=no" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="NextIn" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" />
      {family ? startupImages(family, locale === "en" ? "en" : "fr").map((image) => <link key={image.url} rel="apple-touch-startup-image" href={image.url} media={image.media} />) : null}
    </>
  );
}

/** Lecture à l'exécution : un accès calculé n'est pas remplacé au build (interrupteur sans nouveau déploiement). */
function runtimeEnv(name: string): string | undefined {
  return process.env[name];
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, requestHeaders, t] = await Promise.all([getLocale(), headers(), getTranslations("common")]);
  const family = appleStartupFamily(requestHeaders.get("user-agent"));
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: splashCss }} />
        {/* Erreurs du navigateur vers /api/client-log (diagnostic de l'écran blanc), avant tout autre script. */}
        <script dangerouslySetInnerHTML={{ __html: clientErrorScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AppleWebAppTags family={family} locale={locale} />
      </head>
      <body>
        {/* Filet de la première peinture (sans JS ni police) : écran de démarrage tant que la feuille de style de
            l'application n'est pas appliquée (`lib/pwa/splash.ts`, identique aux images iOS). */}
        <div id="nx-s" aria-hidden dangerouslySetInnerHTML={{ __html: splashHtml(t("appName"), t("tagline")) }} />
        {children}
        <ServiceWorkerRegister enabled={runtimeEnv("NEXT_PUBLIC_SW_ENABLED") !== "false"} />
      </body>
    </html>
  );
}
