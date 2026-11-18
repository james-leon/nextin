/**
 * Écrans de démarrage iOS (`apple-touch-startup-image`) : un fichier par taille d'écran, en clair et en sombre.
 * Les dimensions sont en points CSS (portrait) ; le fichier fait `width × ratio` sur `height × ratio` pixels.
 * Images générées par `scripts/generate-startup-images.mjs` dans `public/startup/`. Liste courte (iPhone récents, SE,
 * iPad Air) : chaque taille ajoute deux balises à toutes les pages, comptées dans le budget de 200 Ko des pages client.
 * Sur un autre écran, iOS affiche la couleur de fond de la page au lieu de l'image.
 */
export type StartupDevice = { width: number; height: number; ratio: number };

export const STARTUP_DEVICES: StartupDevice[] = [
  { width: 440, height: 956, ratio: 3 }, // iPhone 16 Pro Max
  { width: 402, height: 874, ratio: 3 }, // iPhone 16 Pro
  { width: 430, height: 932, ratio: 3 }, // iPhone 14 Pro Max à 16 Plus
  { width: 393, height: 852, ratio: 3 }, // iPhone 14 Pro à 16
  { width: 390, height: 844, ratio: 3 }, // iPhone 12 à 14
  { width: 375, height: 812, ratio: 3 }, // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  { width: 414, height: 896, ratio: 2 }, // iPhone XR, 11
  { width: 375, height: 667, ratio: 2 }, // iPhone 6s à 8, SE (2e et 3e générations)
  { width: 820, height: 1180, ratio: 2 }, // iPad Air
];

export function startupFileName(d: StartupDevice, scheme: "light" | "dark"): string {
  return `startup-${d.width * d.ratio}x${d.height * d.ratio}-${scheme}.png`;
}

/** Entrées de `metadata.appleWebApp.startupImage` (portrait, clair puis sombre). */
export function startupImages(): { url: string; media: string }[] {
  return STARTUP_DEVICES.flatMap((d) =>
    (["light", "dark"] as const).map((scheme) => ({
      url: `/startup/${startupFileName(d, scheme)}`,
      media: `(device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
    })),
  );
}
