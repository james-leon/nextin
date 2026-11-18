import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTUP_DEVICES, appleStartupFamily, startupFileName, startupImages } from "./startup-images";

const PUBLIC = join(__dirname, "../../public");

describe("écrans de démarrage iOS", () => {
  it("chaque taille a ses deux images (claire et sombre) dans public/startup/", () => {
    for (const device of STARTUP_DEVICES) {
      for (const scheme of ["light", "dark"] as const) {
        const file = join(PUBLIC, "startup", startupFileName(device, scheme));
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeGreaterThan(0);
      }
    }
  });

  it("aucune taille en double", () => {
    const keys = STARTUP_DEVICES.map((d) => `${d.width}x${d.height}@${d.ratio}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("couvre l'iPhone 12 Pro Max et les iPhone et iPad récents", () => {
    const keys = new Set(STARTUP_DEVICES.map((d) => `${d.width}x${d.height}@${d.ratio}`));
    for (const key of ["375x667@2", "428x926@3", "390x844@3", "393x852@3", "430x932@3", "402x874@3", "420x912@3", "440x956@3", "820x1180@2", "1032x1376@2"]) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  it("balises : une par taille et par thème, requête média complète", () => {
    const images = startupImages();
    expect(images).toHaveLength(STARTUP_DEVICES.length * 2);
    expect(startupImages("iphone")).toHaveLength(STARTUP_DEVICES.filter((d) => d.family === "iphone").length * 2);
    expect(startupImages("iphone").every((i) => !startupImages("ipad").some((j) => j.url === i.url))).toBe(true);
    expect(startupImages("iphone").length + startupImages("ipad").length).toBe(images.length);
    expect(images[0]!.media).toMatch(/device-width: \d+px.*device-height: \d+px.*-webkit-device-pixel-ratio: \d.*orientation: portrait.*prefers-color-scheme: (light|dark)/);
  });

  it("balises envoyées aux seuls navigateurs Apple, pour leur famille d'appareils", () => {
    expect(appleStartupFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("iphone");
    expect(appleStartupFamily("Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1")).toBe("ipad");
    // iPadOS 13+ se présente comme un Mac.
    expect(appleStartupFamily("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")).toBe("ipad");
    expect(appleStartupFamily("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36")).toBeNull();
    expect(appleStartupFamily("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36")).toBeNull();
    expect(appleStartupFamily(null)).toBeNull();
  });
});
