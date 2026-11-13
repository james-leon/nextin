import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import { themeInitScript } from "@/components/theme/theme";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
