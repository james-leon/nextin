/**
 * Écrans de démarrage iOS (`apple-touch-startup-image`) : un fichier par taille d'écran, en clair et en sombre.
 * Les dimensions sont en points CSS (portrait) ; le fichier fait `width × ratio` sur `height × ratio` pixels.
 * Images générées par `scripts/generate-startup-images.mjs` dans `public/startup/` (test : `startup-images.test.ts`).
 * Tous les iPhone depuis le 6 et tous les iPad récents, en portrait. Sur un écran absent de la liste, iOS n'affiche
 * aucune image : le fond et le logo peints par le CSS en ligne du gabarit (`splashStyle` de `app/layout.tsx`) prennent le relais.
 * Balises envoyées aux seuls navigateurs Apple (`appleStartupFamily`) : ailleurs, elles ne servent à rien et pèseraient
 * sur le budget de 200 Ko des pages client.
 */
export type StartupFamily = "iphone" | "ipad";
export type StartupDevice = { family: StartupFamily; width: number; height: number; ratio: number };

export const STARTUP_DEVICES: StartupDevice[] = [
  // iPhone
  { family: "iphone", width: 375, height: 667, ratio: 2 }, // iPhone 6, 6s, 7, 8, SE (2e et 3e génération)
  { family: "iphone", width: 414, height: 736, ratio: 3 }, // iPhone 6 Plus, 6s Plus, 7 Plus, 8 Plus
  { family: "iphone", width: 375, height: 812, ratio: 3 }, // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  { family: "iphone", width: 414, height: 896, ratio: 2 }, // iPhone XR, 11
  { family: "iphone", width: 414, height: 896, ratio: 3 }, // iPhone XS Max, 11 Pro Max
  { family: "iphone", width: 390, height: 844, ratio: 3 }, // iPhone 12, 12 Pro, 13, 13 Pro, 14
  { family: "iphone", width: 428, height: 926, ratio: 3 }, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  { family: "iphone", width: 393, height: 852, ratio: 3 }, // iPhone 14 Pro, 15, 15 Pro, 16
  { family: "iphone", width: 430, height: 932, ratio: 3 }, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { family: "iphone", width: 402, height: 874, ratio: 3 }, // iPhone 16 Pro, 17, 17 Pro
  { family: "iphone", width: 420, height: 912, ratio: 3 }, // iPhone Air
  { family: "iphone", width: 440, height: 956, ratio: 3 }, // iPhone 16 Pro Max, 17 Pro Max
  // iPad
  { family: "ipad", width: 768, height: 1024, ratio: 2 }, // iPad 9,7 pouces (5e et 6e génération), iPad mini 4 et 5, iPad Air 2
  { family: "ipad", width: 744, height: 1133, ratio: 2 }, // iPad mini (6e génération et A17 Pro)
  { family: "ipad", width: 810, height: 1080, ratio: 2 }, // iPad 10,2 pouces (7e, 8e et 9e génération)
  { family: "ipad", width: 820, height: 1180, ratio: 2 }, // iPad Air (4e et 5e génération), iPad (10e génération et A16)
  { family: "ipad", width: 834, height: 1112, ratio: 2 }, // iPad Pro 10,5 pouces, iPad Air (3e génération)
  { family: "ipad", width: 834, height: 1194, ratio: 2 }, // iPad Pro 11 pouces (1re à 4e génération), iPad Air 11 pouces (M2, M3)
  { family: "ipad", width: 834, height: 1210, ratio: 2 }, // iPad Pro 11 pouces (M4)
  { family: "ipad", width: 1024, height: 1366, ratio: 2 }, // iPad Pro 12,9 pouces (toutes générations), iPad Air 13 pouces (M2, M3)
  { family: "ipad", width: 1032, height: 1376, ratio: 2 }, // iPad Pro 13 pouces (M4)
];

export function startupFileName(d: StartupDevice, scheme: "light" | "dark"): string {
  return `startup-${d.width * d.ratio}x${d.height * d.ratio}-${scheme}.png`;
}

/** Entrées de `metadata.appleWebApp.startupImage` (portrait, clair puis sombre) ; `family` : seulement les tailles
 * d'iPhone ou d'iPad (un iPhone n'a jamais besoin des images d'iPad, et inversement : moitié moins de balises). */
export function startupImages(family?: StartupFamily): { url: string; media: string }[] {
  return STARTUP_DEVICES.filter((d) => !family || d.family === family).flatMap((d) =>
    (["light", "dark"] as const).map((scheme) => ({
      url: `/startup/${startupFileName(d, scheme)}`,
      media: `(device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
    })),
  );
}

/**
 * Appareil Apple susceptible d'installer la PWA : `iphone` (iPhone, iPod) ou `ipad` (iPad, et Safari « Macintosh » :
 * un iPad sous iPadOS 13+ se présente comme un Mac). null pour les autres navigateurs, qui ignorent
 * `apple-touch-startup-image`.
 */
export function appleStartupFamily(userAgent: string | null | undefined): StartupFamily | null {
  if (!userAgent) return null;
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  if (/iPad/.test(userAgent)) return "ipad";
  return /Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(userAgent) ? "ipad" : null;
}
