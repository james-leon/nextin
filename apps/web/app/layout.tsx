import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { themeInitScript } from "@/components/theme/theme";
import { appleStartupFamily, startupImages, type StartupFamily } from "@/lib/pwa/startup-images";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NextIn", template: "%s · NextIn" },
  description: "Prenez un ticket virtuel et attendez où vous voulez.",
  applicationName: "NextIn",
  formatDetection: { telephone: false },
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
function AppleWebAppTags({ family }: { family: StartupFamily | null }) {
  // Composant synchrone : un composant asynchrone dans le <head> serait suspendu et envoyé en fin de flux.
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="NextIn" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" sizes="180x180" />
      {family ? startupImages(family).map((image) => <link key={image.url} rel="apple-touch-startup-image" href={image.url} media={image.media} />) : null}
    </>
  );
}

/**
 * Filet de sécurité de la première peinture (sans JS ni police) : fond de l'application (#F2F2F7, noir en sombre,
 * comme `background_color` du manifeste et `theme-color`) et logo NextIn centré, tant que la feuille de style de
 * l'application n'est pas appliquée (elle masque ce logo : `html body::before`, hors couche CSS). Le fond est immédiat,
 * le logo vient après 1 s. Utile sur un écran sans image de démarrage iOS, ou si la feuille de style tarde ou manque.
 */
const splashStyle =
  "html{background:#f2f2f7}@media(prefers-color-scheme:dark){html:not([data-theme=light]){background:#000}}html[data-theme=dark]{background:#000}" +
  "body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:50% 50%/96px 96px no-repeat;animation:nx-splash 0s 1s forwards}" +
  // Logo posé après 1 s seulement : si la feuille de style arrive avant (cas normal), l'élément disparaît et l'image
  // n'est jamais téléchargée (budget des pages client).
  "@keyframes nx-splash{to{background-image:url(/icons/icon-192.png)}}";

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
  const [locale, requestHeaders] = await Promise.all([getLocale(), headers()]);
  const family = appleStartupFamily(requestHeaders.get("user-agent"));
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: splashStyle }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AppleWebAppTags family={family} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
