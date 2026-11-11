import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { E2E_NOTIFY } from "./e2e/notify-env";

// Les tests lisent la même configuration locale que l'application (.env.local, non versionné) ; en CI, l'environnement.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2];
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3100);


export default defineConfig({
  testDir: "./e2e",
  // Les données créées par les tests sont supprimées à la fin (base locale) : `pnpm e2e:cleanup` pour le faire à la main.
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  grepInvert: process.env.SCREENSHOTS ? undefined : /@screenshots/,
  grep: process.env.SCREENSHOTS ? /@screenshots/ : undefined,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    // Navigateur déjà installé sur la machine (ex. conteneur de développement) quand sa version diffère de celle de
    // @playwright/test ; en CI, variable absente : navigateur installé par `playwright install`.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/design`,
    // M7 : faux fournisseurs (aucun message réel, même avec de vraies clés dans .env.local), envoi local (NOTIFY_POLL).
    env: {
      ...(process.env as Record<string, string>),
      ...E2E_NOTIFY,
      WHATSAPP_TOKEN: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
      VAPID_PRIVATE_KEY: "",
      NOTIFY_POLL: "1",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
