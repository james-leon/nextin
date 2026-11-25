import { expect, test } from "@playwright/test";

// iOS : balises de web app dans le <head> pour un iPhone 12 Pro Max (428 × 926 @3x). Sans
// `apple-mobile-web-app-capable`, iOS ignore les écrans de démarrage (Next.js n'émet que `mobile-web-app-capable`) ;
// dans le <body> (métadonnées envoyées en fin de flux), Safari ne les lit pas.
const IPHONE_12_PRO_MAX_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test.describe("PWA iOS : balises de web app", () => {
  test.skip(({ isMobile }) => !isMobile, "HTML identique sur les deux projets : une passe suffit");

  test("« / » pour un iPhone 12 Pro Max : capable (Apple et générique), titre, barre d'état, écran de démarrage", async ({ request }) => {
    const response = await request.get("/", { headers: { "user-agent": IPHONE_12_PRO_MAX_UA } });
    expect(response.ok()).toBe(true);
    const html = await response.text();
    // Tout dans le <head> (jamais diffusé plus tard dans le <body>, où Safari ne le lit pas).
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toMatch(/<meta name="apple-mobile-web-app-capable" content="yes"\/?>/);
    expect(head).toMatch(/<meta name="mobile-web-app-capable" content="yes"\/?>/);
    expect(head).toMatch(/<meta name="apple-mobile-web-app-title" content="NextIn"\/?>/);
    expect(head).toMatch(/<meta name="apple-mobile-web-app-status-bar-style" content="default"\/?>/);
    // Ni numéro, ni adresse e-mail masquée (« l•••@gmail.com »), ni adresse transformés en liens par iOS.
    expect(head).toMatch(/<meta name="format-detection" content="telephone=no, email=no, address=no"\/?>/);
    // Écran de l'iPhone 12 Pro Max, en clair et en sombre.
    for (const scheme of ["light", "dark"]) {
      expect(head).toContain(`href="/startup/startup-1284x2778-${scheme}.png"`);
    }
    const startupLinks = head.match(/<link[^>]*rel="apple-touch-startup-image"[^>]*>/g) ?? [];
    expect(
      startupLinks.some(
        (link) =>
          link.includes('href="/startup/startup-1284x2778-light.png"') &&
          link.includes(
            'media="(device-width:428px) and (device-height:926px) and (-webkit-device-pixel-ratio:3) and (orientation:portrait) and (prefers-color-scheme:light)"',
          ),
      ),
    ).toBe(true);
    // Pages dont les métadonnées attendent des données (« Mon ticket », choix du service) : balises iOS toujours dans le
    // <head>, à chaque chargement (l'ordre d'envoi du flux varie d'une requête à l'autre).
    for (const path of ["/t/AAAAAAAAAAAAAAAAAAAAAA", "/q/AAAAAAAAAAAAAAAAAAAAAA", "/c"]) {
      for (let i = 0; i < 5; i++) {
        const page = await (await request.get(path, { headers: { "user-agent": IPHONE_12_PRO_MAX_UA } })).text();
        const pageHead = page.slice(0, page.indexOf("</head>"));
        expect(pageHead, path).toContain('<meta name="apple-mobile-web-app-capable" content="yes"/>');
        expect(pageHead, path).toContain('href="/startup/startup-1284x2778-dark.png"');
        expect(pageHead.match(/name="apple-mobile-web-app-capable"/g), `${path} : une seule fois`).toHaveLength(1);
        expect(pageHead.match(/name="format-detection"/g), `${path} : format-detection une seule fois`).toHaveLength(1);
      }
    }
    // L'image annoncée existe bien.
    expect((await request.get("/startup/startup-1284x2778-light.png")).ok()).toBe(true);
  });

  test("en anglais : écrans de démarrage au slogan traduit", async ({ request }) => {
    const html = await (
      await request.get("/", { headers: { "user-agent": IPHONE_12_PRO_MAX_UA, cookie: "NEXTIN_LOCALE=en" } })
    ).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('href="/startup/startup-1284x2778-light-en.png"');
    expect(head).not.toContain('href="/startup/startup-1284x2778-light.png"');
    expect((await request.get("/startup/startup-1284x2778-dark-en.png")).ok()).toBe(true);
  });
});

