import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { themeInitScript } from "@/components/theme/theme";
import { appleStartupFamily, startupImages } from "@/lib/pwa/startup-images";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const baseMetadata: Metadata = {
  title: { default: "NextIn", template: "%s · NextIn" },
  description: "Prenez un ticket virtuel et attendez où vous voulez.",
  applicationName: "NextIn",
  appleWebApp: { capable: true, title: "NextIn", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    // Favicon : N seul (SVG pour les navigateurs récents, PNG 32 et 16 en repli). Icône pleine pour iOS.
    icon: [
      { url: "/brand/nextin-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  // Écrans de démarrage clair et sombre (iPhone et iPad, `lib/pwa/startup-images.ts`) : seulement pour les navigateurs
  // Apple, les seuls à les lire, et pour leur seule famille (iPhone : 24 balises, iPad : 18 ; budget des pages client).
  const family = appleStartupFamily((await headers()).get("user-agent"));
  if (!family) return baseMetadata;
  return { ...baseMetadata, appleWebApp: { ...(baseMetadata.appleWebApp as object), startupImage: startupImages(family) } };
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
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: splashStyle }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
