import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { bannerPng } from "../../../scripts/demo-images";
import { pairDisplay, today } from "./ads-helpers";
import { addDoctors, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

/**
 * Revue responsive (`docs/REVUE-RESPONSIVE.md`, section 4) : critères d'acceptation vérifiés sur les écrans du
 * personnel, du téléphone (360 px) au grand écran (1920 px).
 */
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

type Size = { name: string; width: number; height: number; touch: boolean };
const PHONE_360: Size = { name: "360", width: 360, height: 780, touch: true };
const PHONE: Size = { name: "390", width: 390, height: 844, touch: true };
const TABLET_PORTRAIT: Size = { name: "820", width: 820, height: 1180, touch: true };
const TABLET_LANDSCAPE: Size = { name: "1180", width: 1180, height: 820, touch: true };
const DESKTOP: Size = { name: "1440", width: 1440, height: 900, touch: false };
const WIDE: Size = { name: "1920", width: 1920, height: 1080, touch: false };
const ALL = [PHONE_360, PHONE, TABLET_PORTRAIT, TABLET_LANDSCAPE, DESKTOP, WIDE];

type User = "owner" | "advertiser" | "visitor";
type Screen = { name: string; path: string; user: User; primary?: (page: Page) => Locator };
type Fixture = { owner: string; advertiser: string; screens: Screen[]; branchId: string; staff: Awaited<ReturnType<typeof setUpBranch>>["staff"] };
const USERS: User[] = ["owner", "advertiser", "visitor"];

let fixture: Fixture;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const b = await setUpBranch(`Clinique Responsive ${Date.now()}`);
  await addDoctors(b);
  const tickets: { public_token: string }[] = [];
  for (let i = 0; i < 14; i++) tickets.push(await rpc<{ public_token: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId }));
  const advertiser = uniqueEmail("annonceur");
  await admin.auth.admin.createUser({ email: advertiser, password: PASSWORD, email_confirm: true });
  const adv = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, supabaseOptions);
  await adv.auth.signInWithPassword({ email: advertiser, password: PASSWORD });
  const advertiserId = await rpc<string>(adv, "create_advertiser", { p_name: "Boulangerie Responsive", p_sector: "food", p_phone: null, p_city: "Douala" });
  const campaignId = await rpc<string>(adv, "save_campaign", {
    p_campaign: null,
    p_advertiser: advertiserId,
    p_organization: null,
    p_fields: { name: "Rentrée gourmande", package_code: "argent", sector: "food", starts_on: today(), surfaces: ["tv"], target_cities: [], target_org_types: [], schedules: [] },
  });
  const creative = `${advertiserId}/${campaignId}/visuel.png`;
  await adv.storage.from("ad-creatives").upload(creative, bannerPng("#1A6BB5", "#0D2C54"), { contentType: "image/png" });
  await rpc(adv, "save_creative", { p_campaign: campaignId, p_creative: null, p_fields: { storage_path: creative, kind: "image", headline: "Pain tout chaud", duration_seconds: 8 } });

  const root = `/app/o/${b.orgId}`;
  const base = `${root}/branches/${b.branchId}`;
  fixture = {
    owner: b.email,
    advertiser,
    branchId: b.branchId,
    staff: b.staff,
    screens: [
      { name: "home", path: "/app", user: "owner" },
      { name: "overview", path: root, user: "owner" },
      { name: "branches", path: `${root}/branches`, user: "owner", primary: (p) => p.getByRole("link", { name: "Nouvelle agence" }) },
      { name: "branch", path: base, user: "owner", primary: (p) => p.getByRole("link", { name: /Ouvrir les postes/ }) },
      { name: "services", path: `${base}/services`, user: "owner", primary: (p) => p.getByRole("link", { name: "Nouveau service" }) },
      { name: "service", path: `${base}/services/${b.serviceId}`, user: "owner", primary: (p) => p.getByRole("button", { name: "Enregistrer" }) },
      { name: "counters", path: `${base}/counters`, user: "owner", primary: (p) => p.getByRole("link", { name: "Nouveau guichet ou cabinet" }) },
      { name: "counter", path: `${base}/counters/${b.counterId}`, user: "owner", primary: (p) => p.getByRole("button", { name: "Enregistrer" }) },
      { name: "practitioners", path: `${root}/practitioners`, user: "owner", primary: (p) => p.getByRole("link", { name: "Nouveau praticien" }) },
      { name: "staff", path: `${root}/staff`, user: "owner", primary: (p) => p.getByRole("link", { name: "Inviter un membre" }) },
      { name: "displays", path: `${base}/displays`, user: "owner" },
      { name: "branch-settings", path: `${base}/settings`, user: "owner" },
      { name: "org-ads", path: `${root}/ads`, user: "owner" },
      { name: "billing", path: `${root}/billing`, user: "owner" },
      { name: "settings", path: "/app/settings", user: "owner" },
      { name: "desk-choice", path: "/desk", user: "owner", primary: (p) => p.getByRole("link", { name: /^Accueil/ }) },
      { name: "reception", path: `/desk/reception/${b.branchId}`, user: "owner", primary: (p) => p.getByRole("button", { name: "Nouveau ticket" }) },
      {
        name: "appointments",
        path: `/desk/reception/${b.branchId}/appointments`,
        user: "owner",
        primary: (p) => p.getByRole("button", { name: "Nouveau rendez-vous" }),
      },
      { name: "desk", path: `/desk/counter/${b.counterId}`, user: "owner", primary: (p) => p.getByRole("button", { name: /Alerter le suivant|Ouvrir le poste/ }) },
      { name: "ads-new", path: "/ads/campaigns/new", user: "advertiser", primary: (p) => p.getByRole("button", { name: "Enregistrer" }) },
      { name: "ads-redeem", path: "/ads/redeem", user: "advertiser" },
      { name: "ads-campaign", path: `/ads/campaigns/${campaignId}`, user: "advertiser", primary: (p) => p.getByRole("button", { name: "Soumettre à la validation" }) },
      // Pages client (visiteur anonyme), barre d'onglets latérale à partir de 1024 px (R5).
      { name: "client-scanner", path: "/", user: "visitor" },
      { name: "client-code", path: "/c", user: "visitor" },
      { name: "client-service", path: `/q/${b.entryCode}`, user: "visitor" },
      { name: "client-ticket", path: `/t/${tickets[13]!.public_token}`, user: "visitor" },
      { name: "client-my-ticket", path: "/t", user: "visitor" },
      { name: "client-nearby", path: "/nearby", user: "visitor" },
      { name: "client-branch", path: `/b/${b.branchId}`, user: "visitor" },
      { name: "client-profile", path: "/profile", user: "visitor" },
    ],
  };
});

const sessions = new Map<string, Awaited<ReturnType<BrowserContext["storageState"]>>>();

/** Contexte à la taille voulue, déjà connecté (session mémorisée par compte). */
async function open(browser: Browser, size: Size, user: User, colorScheme: "light" | "dark" = "light") {
  const email = user === "owner" ? fixture.owner : user === "advertiser" ? fixture.advertiser : null;
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    hasTouch: size.touch,
    isMobile: size.touch && size.width < 1024,
    colorScheme,
    locale: "fr-FR",
    storageState: email ? sessions.get(email) : undefined,
  });
  const page = await context.newPage();
  if (email && !sessions.has(email)) {
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    sessions.set(email, await context.storageState());
  }
  return { context, page };
}

async function visit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

/** Critère 3 : aucun débordement horizontal, aucun texte coupé sans points de suspension. */
async function expectNoOverflow(page: Page, label: string) {
  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    const cut: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      // Doublons masqués aux lecteurs d'écran (titre réduit de la barre, identique au grand titre) : non jugés.
      if (el.offsetParent === null || el.closest('[aria-hidden="true"]')) continue;
      const style = getComputedStyle(el);
      // Texte écrasé à zéro (colonne trop étroite) : le pire cas de texte coupé. Les textes réservés aux lecteurs
      // d'écran (`sr-only`, positionnés hors du flux) sont exclus.
      // (`clientWidth` vaut toujours 0 pour une boîte en ligne : on ne juge que les boîtes de bloc.)
      if (style.display === "inline" || style.display === "contents") continue;
      if (el.getBoundingClientRect().width <= 1) {
        const text = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        if (text && style.position !== "absolute" && el.getBoundingClientRect().height > 0) cut.push(`${el.tagName.toLowerCase()} « ${el.textContent?.trim().slice(0, 40)} » (largeur nulle)`);
        continue;
      }
      const clips = style.overflowX === "hidden" || style.overflowX === "clip";
      if (!clips || el.scrollWidth <= el.clientWidth + 1) continue;
      if (style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none") continue;
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      if (ownText) cut.push(`${el.tagName.toLowerCase()} « ${el.textContent?.trim().slice(0, 40)} »`);
    }
    return { scroll: doc.scrollWidth, client: doc.clientWidth, cut };
  });
  expect(report.scroll, `${label} : débordement horizontal`).toBeLessThanOrEqual(report.client);
  expect(report.cut, `${label} : texte coupé`).toEqual([]);
}

/** Critère 4 : après défilement, le dernier élément de liste est entièrement visible, jamais sous une barre fixe. */
async function expectLastItemClear(page: Page, label: string) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  const res = await page.evaluate(() => {
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null && el.getBoundingClientRect().height > 0;
    const items = Array.from(document.querySelectorAll("main li, main tr")).filter(visible);
    const last = items.at(-1);
    if (!last) return null;
    const r = last.getBoundingClientRect();
    const bars = Array.from(document.querySelectorAll<HTMLElement>(".safe-bottom"))
      .filter((b) => visible(b) && ["fixed", "sticky"].includes(getComputedStyle(b).position))
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top);
    // Barre au-dessus de l'élément : seul son dégradé transparent (24 px) peut le recouvrir.
    const covered = bars.filter((b) => b.top + 24 < r.bottom);
    return { bottom: r.bottom, height: window.innerHeight, covered: covered.length, text: last.textContent?.trim().slice(0, 30) };
  });
  if (!res) return;
  expect(res.bottom, `${label} : dernier élément « ${res.text} » hors de l'écran`).toBeLessThanOrEqual(res.height + 1);
  expect(res.covered, `${label} : dernier élément « ${res.text} » sous une barre fixe`).toBe(0);
}

/** Critère 5 : action principale visible sans défilement. */
async function expectPrimaryVisible(page: Page, primary: Locator, label: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const action = primary.filter({ visible: true }).first();
  await expect(action, `${label} : action principale`).toBeVisible();
  const box = (await action.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y, `${label} : action principale sous le haut de l'écran`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `${label} : action principale visible sans défilement`).toBeLessThanOrEqual(viewport.height);
}

/** Critère 2 : sur ordinateur, aucune bande verticale vide de plus de 40 % de la largeur. */
async function expectNoLargeEmptyZone(page: Page, label: string) {
  const gap = await page.evaluate(() => {
    const width = window.innerWidth;
    const spans: [number, number][] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.top > window.innerHeight || r.bottom < 0 || r.width >= width - 1) continue;
      const style = getComputedStyle(el);
      const painted =
        Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) ||
        ["svg", "img", "input", "button", "canvas", "video"].includes(el.tagName.toLowerCase()) ||
        (style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent");
      if (painted) spans.push([Math.max(0, r.left), Math.min(width, r.right)]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    let largest = 0;
    let reach = 0;
    for (const [from, to] of spans) {
      largest = Math.max(largest, from - reach);
      reach = Math.max(reach, to);
    }
    largest = Math.max(largest, width - reach);
    return largest / width;
  });
  expect(gap, `${label} : zone vide de ${Math.round(gap * 100)} % de la largeur`).toBeLessThanOrEqual(0.4);
}

test.describe("Revue responsive — critères d'acceptation (section 4)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "tailles pilotées par le test"));

  for (const size of ALL) {
    test(`${size.name} px : pas de débordement, dernière ligne visible, action principale sans défilement`, async ({ browser }) => {
      test.setTimeout(240_000);
      for (const user of USERS) {
        const { context, page } = await open(browser, size, user);
        for (const screen of fixture.screens.filter((s) => s.user === user)) {
          await visit(page, screen.path);
          const label = `${screen.name} (${size.name} px)`;
          await expectNoOverflow(page, label);
          if (screen.primary) await expectPrimaryVisible(page, screen.primary(page), label);
          if (size.width >= 1440) await expectNoLargeEmptyZone(page, label);
          if (size.touch && size.width < 1024) await expectLastItemClear(page, label);
          if (size.touch) await expectTouchTargets(page);
        }
        await context.close();
      }
    });
  }

  test("360 px avec la taille de texte à 125 % : rien ne déborde", async ({ browser }) => {
    test.setTimeout(240_000);
    for (const user of USERS) {
      const { context, page } = await open(browser, PHONE_360, user);
      await context.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = "125%";
        });
      });
      for (const screen of fixture.screens.filter((s) => s.user === user)) {
        await visit(page, screen.path);
        await expectNoOverflow(page, `${screen.name} (360 px, texte 125 %)`);
      }
      await context.close();
    }
  });

  for (const scheme of ["light", "dark"] as const) {
    for (const size of [PHONE, TABLET_PORTRAIT, DESKTOP]) {
      test(`contrastes AA et rôles (axe) : ${scheme === "light" ? "clair" : "sombre"}, ${size.name} px`, async ({ browser }) => {
        test.setTimeout(240_000);
        for (const user of USERS) {
          const { context, page } = await open(browser, size, user, scheme);
          for (const screen of fixture.screens.filter((s) => s.user === user)) {
            await visit(page, screen.path);
            await expectAccessible(page);
          }
          await context.close();
        }
      });
    }
  }

  test("tablette portrait : barre latérale repliable (bouton en haut à gauche, Échap, fermeture en naviguant)", async ({ browser }) => {
    const { context, page } = await open(browser, TABLET_PORTRAIT, "owner");
    const services = fixture.screens.find((s) => s.name === "services")!;
    await visit(page, services.path);
    const nav = page.getByRole("navigation", { name: "Navigation de l'établissement" });
    await expect(nav).toBeHidden();
    const toggle = page.getByRole("button", { name: "Afficher la barre latérale" });
    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(page.getByRole("button", { name: "Masquer la barre latérale" }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await nav.getByRole("link", { name: "Personnel" }).click();
    await page.waitForURL(/\/staff$/);
    await expect(nav).toBeHidden();
    await context.close();

    // Tablette paysage et ordinateur : barre latérale toujours visible, pas de bouton.
    const wide = await open(browser, TABLET_LANDSCAPE, "owner");
    await visit(wide.page, services.path);
    await expect(wide.page.getByRole("navigation", { name: "Navigation de l'établissement" })).toBeVisible();
    await expect(wide.page.getByRole("button", { name: "Afficher la barre latérale" })).toBeHidden();
    await wide.context.close();
  });

  test("maître-détail : liste et détail côte à côte à partir de la tablette, élément surligné, édition sans quitter la liste", async ({ browser }) => {
    const services = fixture.screens.find((s) => s.name === "service")!;
    const { context, page } = await open(browser, DESKTOP, "owner");
    await visit(page, services.path);
    const current = page.getByRole("link", { name: /Consultation/ }).and(page.locator('[aria-current="page"]'));
    await expect(current).toBeVisible();
    const list = (await page.locator('[data-split="list"]').boundingBox())!;
    const detail = (await page.locator('[data-split="detail"]').boundingBox())!;
    expect(detail.x).toBeGreaterThanOrEqual(list.x + list.width - 1);
    expect(list.width).toBeGreaterThanOrEqual(300);
    expect(list.width).toBeLessThanOrEqual(400);
    // Retour masqué : la liste est à côté.
    await expect(page.getByRole("link", { name: "Services" }).and(page.locator("[data-split=detail] *"))).toHaveCount(0);
    await page.getByRole("link", { name: /Pédiatrie/ }).click();
    await page.waitForURL(/\/services\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pédiatrie" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Consultation/ })).toBeVisible();
    await context.close();

    // Téléphone : la liste seule, puis le détail seul avec un retour.
    const phone = await open(browser, PHONE, "owner");
    await visit(phone.page, services.path.replace(/\/[0-9a-f-]+$/, ""));
    await expect(phone.page.getByRole("heading", { level: 1, name: "Services" })).toBeVisible();
    await phone.page.getByRole("link", { name: /Pédiatrie/ }).click();
    await expect(phone.page.getByRole("heading", { level: 1, name: "Pédiatrie" })).toBeVisible();
    await expect(phone.page.getByRole("link", { name: /Consultation/ })).toBeHidden();
    await expect(phone.page.getByRole("link", { name: "Services" })).toBeVisible();
    await phone.context.close();
  });

  test("barre d'action : dans la barre de titre sur ordinateur, à la largeur du contenu sur tablette", async ({ browser }) => {
    const staff = fixture.screens.find((s) => s.name === "staff")!;
    const desktop = await open(browser, DESKTOP, "owner");
    await visit(desktop.page, staff.path);
    const invite = desktop.page.getByRole("link", { name: "Inviter un membre" }).filter({ visible: true });
    await expect(invite).toHaveCount(1);
    const title = (await desktop.page.getByRole("heading", { level: 1 }).boundingBox())!;
    const box = (await invite.boundingBox())!;
    expect(box.y).toBeLessThan(title.y + title.height);
    expect(box.y + box.height).toBeGreaterThan(title.y);
    // Le formulaire d'un service s'enregistre depuis la barre de titre.
    const service = fixture.screens.find((s) => s.name === "service")!;
    await visit(desktop.page, service.path);
    await desktop.page.getByRole("button", { name: "Enregistrer" }).filter({ visible: true }).click();
    await desktop.page.waitForURL(/\/services\?saved=1$/);
    await expect(desktop.page.getByText("Modifications enregistrées").first()).toBeVisible();
    await desktop.context.close();

    const tablet = await open(browser, TABLET_PORTRAIT, "owner");
    await visit(tablet.page, staff.path);
    const bar = tablet.page.locator(".safe-bottom").filter({ visible: true }).first();
    const content = (await tablet.page.getByRole("heading", { level: 1 }).boundingBox())!;
    const barBox = (await bar.locator("a").boundingBox())!;
    expect(Math.abs(barBox.x - content.x)).toBeLessThanOrEqual(2);
    await tablet.context.close();
  });

  test("téléphone : retour jamais tronqué, sous-titres sur deux lignes au plus, segmented control sur une ligne", async ({ browser }) => {
    const { context, page } = await open(browser, PHONE_360, "owner");
    for (const screen of fixture.screens.filter((s) => s.user === "owner")) {
      await visit(page, screen.path);
      const backs = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-nav-grid] a span, [data-nav-grid] button span"))
          .filter((s) => s.offsetParent !== null && s.clientWidth > 1)
          .map((s) => ({ text: s.textContent, cut: s.scrollWidth > s.clientWidth + 1 || s.getBoundingClientRect().right > window.innerWidth })),
      );
      expect(backs.filter((b) => b.cut), `${screen.name} : retour tronqué`).toEqual([]);
      const segments = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[role=group] > button[role=radio], [data-orientation] > button[role=radio]"))
          .filter((b) => b.offsetParent !== null)
          .map((b) => b.getBoundingClientRect().height),
      );
      for (const h of segments) expect(h, `${screen.name} : segment sur deux lignes`).toBeLessThanOrEqual(44);
    }
    await context.close();
  });

  test("écran TV : proportions et textes entiers en 1280 × 720 comme en 3840 × 2160", async ({ browser, request }) => {
    const device = await pairDisplay(request, fixture.staff, fixture.branchId, false);
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
      [3840, 2160],
    ] as const) {
      const context = await browser.newContext({ viewport: { width, height }, locale: "fr-FR" });
      await context.addInitScript((token) => localStorage.setItem("nextin-tv-token", token), device);
      const page = await context.newPage();
      await page.goto("/tv");
      await expect(page.getByText("File d'attente", { exact: true })).toBeVisible();
      await page.waitForTimeout(500);
      const label = `TV ${width}×${height}`;
      await expectNoOverflow(page, label);
      // Tout l'écran, sans défilement : la page tient exactement dans la télévision.
      const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
      expect(fits, `${label} : défilement vertical`).toBe(true);
      // Proportions : le titre de la file occupe la même part de la hauteur quelle que soit la définition.
      const ratio = await page.getByText("File d'attente", { exact: true }).evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);
      expect(ratio, `${label} : proportion du titre`).toBeGreaterThan(0.02);
      expect(ratio, `${label} : proportion du titre`).toBeLessThan(0.06);
      await context.close();
    }
  });
});
