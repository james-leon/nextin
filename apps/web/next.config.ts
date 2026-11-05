import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { documentSecurityHeaders } from "./lib/security/headers";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// nosniff sur toutes les réponses ; les en-têtes propres aux documents (CSP, cadres, référent, permissions, HSTS) ne
// sont renvoyés ni avec les fichiers statiques versionnés de /_next/static ni avec les réponses JSON de /api (sans effet
// sur un script, une feuille de style ou du JSON, et autant d'octets en moins par requête : budget < 200 Ko).
const contentTypeHeaders = [{ key: "X-Content-Type-Options", value: "nosniff" }];
const documentHeaders = documentSecurityHeaders(process.env);

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
      { source: "/((?!_next/static/|api/).*)", headers: documentHeaders },
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
