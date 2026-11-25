import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { test, type Browser, type Page } from "@playwright/test";
import { bannerPng } from "../../../scripts/demo-images";
import { activeCampaign, admin, platformAdmin, signedIn, today } from "./ads-helpers";
import { PASSWORD, signInViaUi, uniqueEmail } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// Captures du LOT 6a (espace annonceur, maquette v2 24 ; affiche 14 et facture 15) → docs/captures/v2-lot6a/
// (ou V2_SHOTS_OUT) : 390, 820 et 1440 px, clair et sombre ; PDF exportés en PNG (pdftoppm).
const OUT = process.env.V2_SHOTS_OUT ?? "../../docs/captures/v2-lot6a";
const ONLY = process.env.V2_SHOTS_ONLY?.split(",");
const wanted = (name: string) => !ONLY || ONLY.some((p) => name.startsWith(p));
const SIZES = [
  { tag: "390", width: 390, height: 844, touch: true },
  { tag: "820", width: 820, height: 1180, touch: true },
  { tag: "1440", width: 1440, height: 900, touch: false },
] as const;

async function snap(page: Page, name: string) {
  if (!wanted(name)) return;
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

type Fixture = { email: string; campaignId: string; draftId: string; awaitingId: string; orgEmail: string; orgId: string; branchId: string; coupon: string };

async function fixture(): Promise<Fixture> {
  const c = await activeCampaign(`Promo rentrée ${Date.now()}`);
  const adv = await signedIn(c.email);
  const save = (name: string, pkg: string) =>
    rpc<string>(adv, "save_campaign", {
      p_campaign: null,
      p_advertiser: c.advertiserId,
      p_organization: null,
      p_fields: { name, package_code: pkg, sector: "food", starts_on: today(), surfaces: pkg === "bronze" ? ["tv"] : ["tv", "app", "game"], target_cities: ["Douala"], target_org_types: ["clinic", "hospital"], schedules: [] },
    });
  const draftId = await save("Lait infantile", "argent");
  const draftPath = `${c.advertiserId}/${draftId}/visuel.png`;
  await adv.storage.from("ad-creatives").upload(draftPath, bannerPng("#15A05A", "#0E7A44"), { contentType: "image/png" });
  await rpc(adv, "save_creative", { p_campaign: draftId, p_creative: null, p_fields: { storage_path: draftPath, kind: "image", headline: "Lait infantile", offer_text: "-10 % avec votre ticket NextIn", duration_seconds: 10 } });
  const awaitingId = await save("Vaccins de fin d'année", "bronze");
  const awaitingPath = `${c.advertiserId}/${awaitingId}/visuel.png`;
  await adv.storage.from("ad-creatives").upload(awaitingPath, bannerPng("#1A6BB5", "#0D2C54"), { contentType: "image/png" });
  await rpc(adv, "save_creative", { p_campaign: awaitingId, p_creative: null, p_fields: { storage_path: awaitingPath, kind: "image", headline: "Vaccins", duration_seconds: 10 } });
  await rpc(adv, "submit_campaign", { p_campaign: awaitingId });
  const wintek = await platformAdmin();
  await rpc(wintek.client, "review_campaign", { p_campaign: awaitingId, p_approve: true, p_note: "" });
  await rpc(adv, "campaign_checkout", { p_campaign: awaitingId });
  const cashier = uniqueEmail("caissier");
  await admin.auth.admin.createUser({ email: cashier, password: PASSWORD, email_confirm: true });
  await rpc(adv, "add_advertiser_cashier", { p_advertiser: c.advertiserId, p_email: cashier });
  const coupon = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const qr = Array.from({ length: 22 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
  await admin.from("ad_coupons").insert({ campaign_id: c.campaignId, code: coupon, qr_token: qr, reward_text: "-10 % sur votre prochain achat", expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  const b = await setUpBranch(`Douala Clinic ${Date.now()}`);
  return { email: c.email, campaignId: c.campaignId, draftId, awaitingId, orgEmail: b.email, orgId: b.orgId, branchId: b.branchId, coupon };
}

const sessions = new Map<string, Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>>();

async function open(browser: Browser, size: (typeof SIZES)[number], theme: "light" | "dark", email: string) {
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    isMobile: size.touch && size.width < 1024,
    hasTouch: size.touch,
    locale: "fr-FR",
    storageState: sessions.get(email),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  if (!sessions.has(email)) {
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    sessions.set(email, await context.storageState());
  }
  return page;
}

let data: Fixture;

test.describe.serial("@screenshots refonte v2 LOT 6a", () => {
  test.beforeAll(async () => {
    mkdirSync(OUT, { recursive: true });
    data = await fixture();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`écrans ${theme}`, async ({ browser }, info) => {
      test.skip(info.project.name !== "desktop", "une passe suffit : les tailles sont fixées ici");
      test.setTimeout(900_000);
      for (const size of SIZES) {
        const s = `${size.tag}-${theme}`;
        const page = await open(browser, size, theme, data.email);
        await page.goto("/ads/campaigns");
        await snap(page, `01-campagnes-${s}`);
        await page.goto(`/ads/campaigns/${data.campaignId}`);
        await snap(page, `02-campagne-diffusee-${s}`);
        await page.goto(`/ads/campaigns/${data.awaitingId}`);
        await snap(page, `03-campagne-a-payer-${s}`);
        await page.goto("/ads/campaigns/new");
        await page.getByRole("radio", { name: /Argent/ }).click();
        await page.getByLabel("Nom de la campagne").fill("Promo rentrée");
        await snap(page, `04-etape1-formule-${s}`);
        for (const [n, name] of [[2, "ciblage"], [3, "visuels"], [4, "jeux"], [5, "envoi"]] as const) {
          await page.goto(`/ads/campaigns/${data.draftId}/edit?step=${n}`);
          await snap(page, `0${n + 3}-etape${n}-${name}-${s}`);
        }
        await page.goto("/ads/packages");
        await snap(page, `09-formules-${s}`);
        await page.goto("/ads/cashiers");
        await snap(page, `10-caissiers-${s}`);
        await page.goto("/ads/redeem");
        await snap(page, `11-valider-un-bon-${s}`);
        await page.getByLabel("Code du bon").fill(data.coupon);
        await page.getByRole("button", { name: "Vérifier" }).click();
        await page.getByTestId("coupon-result").waitFor();
        await snap(page, `12-bon-valable-${s}`);
        await page.context().close();

        const org = await open(browser, size, theme, data.orgEmail);
        await org.goto(`/app/o/${data.orgId}/ads`);
        await snap(org, `13-publicite-etablissement-${s}`);
        await org.goto(`/app/o/${data.orgId}/ads/house`);
        await snap(org, `14-annonces-maison-${s}`);
        await org.goto(`/app/o/${data.orgId}/ads/new`);
        await org.getByLabel("Titre").fill("Vaccination des enfants");
        await org.getByLabel("Offre").fill("Tous les mercredis, sans rendez-vous");
        await snap(org, `15-annonce-maison-${s}`);
        await org.context().close();
      }
    });
  }

  test("PDF affiche et facture en PNG", async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "une passe");
    const page = await open(browser, SIZES[2], "light", data.orgEmail);
    const pdfs: [string, string][] = [
      [`/app/o/${data.orgId}/branches/${data.branchId}/qr/pdf?format=a4`, "20-affiche-a4"],
      [`/app/o/${data.orgId}/branches/${data.branchId}/qr/pdf?format=a5`, "21-affiche-a5"],
    ];
    const adv = await open(browser, SIZES[2], "light", data.email);
    const { data: invoices } = await admin.from("invoices").select("id, status, campaign_id").in("campaign_id", [data.awaitingId, data.campaignId]);
    const files: [Page, string, string][] = pdfs.map(([url, name]) => [page, url, name]);
    for (const inv of invoices ?? []) files.push([adv, `/ads/invoices/${inv.id}`, inv.status === "paid" ? "23-facture-payee" : "22-facture-a-regler"]);
    for (const [p, url, name] of files) {
      const res = await p.request.get(url);
      const pdf = `${OUT}/${name}.pdf`;
      writeFileSync(pdf, await res.body());
      execFileSync("pdftoppm", ["-png", "-r", "110", "-singlefile", pdf, `${OUT}/${name}`]);
      execFileSync("rm", ["-f", pdf]);
    }
  });
});
