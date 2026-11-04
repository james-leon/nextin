import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// nosniff sur toutes les réponses ; les en-têtes propres aux documents (cadres, référent, permissions) ne sont pas
// renvoyés avec les fichiers statiques versionnés de /_next/static (sans effet sur un script ou une feuille de style,
// et autant d'octets en moins sur chaque requête des pages client, budget < 200 Ko).
const contentTypeHeaders = [{ key: "X-Content-Type-Options", value: "nosniff" }];
const documentHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@nextin/shared", "@nextin/payments"],
  // Test sur téléphone en Wi-Fi (scripts/dev-lan.mjs) : le serveur de dev accepte l'adresse IP du PC.
  allowedDevOrigins: process.env.DEV_LAN_HOST ? [process.env.DEV_LAN_HOST] : [],
  agentRules: false,
  // Indicateur du serveur de dev en bas à gauche : il ne recouvre plus les actions en bas à droite.
  devIndicators: { position: "bottom-left" },
  // Génération PDF côté serveur ; les polices Inter (OFL) accompagnent les fonctions serverless.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: { "/**": ["./lib/pdf/fonts/*.woff"] },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: contentTypeHeaders },
      { source: "/((?!_next/static/).*)", headers: documentHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
