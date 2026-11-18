/**
 * Description courte d'un appareil à partir de son User-Agent (« Safari · iPhone », « Chrome · Windows »), pour la
 * liste des appareils connectés. Volontairement grossière : aucun numéro de version, rien d'identifiant.
 */
export type DeviceDescription = { browser: string | null; os: string | null };

const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function describeUserAgent(ua: string | null | undefined): DeviceDescription {
  if (!ua) return { browser: null, os: null };
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null;
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null;
  return { browser, os };
}
