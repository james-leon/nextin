import { test, type Browser, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { addDoctors, rpc, setUpBranch } from "./queue-helpers";

// Captures M5b (rendez-vous) en téléphone, tablette (portrait et paysage) et ordinateur → docs/captures/m5b/.
const OUT = "../../docs/captures/m5b";
const SIZES = {
  mobile: { width: 390, height: 844, isMobile: true },
  "tablet-portrait": { width: 820, height: 1180, isMobile: true },
  "tablet-landscape": { width: 1180, height: 820, isMobile: true },
  desktop: { width: 1440, height: 900, isMobile: false },
} as const;
type Size = keyof typeof SIZES;

async function prepare() {
  const b = await setUpBranch("DOUALA CLINIC");
  const docs = await addDoctors(b);
  for (const practitioner of [docs.abena, docs.bilong]) {
    await b.staff.from("practitioner_schedules").insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        organization_id: b.orgId,
        branch_id: b.branchId,
        practitioner_id: practitioner,
        service_id: b.serviceId,
        weekday,
        starts_at: "07:00",
        ends_at: "19:00",
        slot_minutes: 20,
      })),
    );
  }
  const labels = ["M.N.", "A.T.", "J.K.", "B.E.", "C.F.", "R.M.", "S.O.", "L.D."];
  let n = 0;
  const booked: string[] = [];
  for (const practitioner of [docs.abena, docs.bilong]) {
    const slots = await rpc<{ starts_at: string }[]>(b.staff, "available_slots", {
      p_practitioner: practitioner,
      p_from: new Date().toISOString().slice(0, 10),
      p_days: 6,
    });
    const byDay = new Map<string, { starts_at: string }[]>();
    for (const s of slots) byDay.set(s.starts_at.slice(0, 10), [...(byDay.get(s.starts_at.slice(0, 10)) ?? []), s]);
    for (const daySlots of byDay.values()) {
      for (const s of daySlots.filter((_, i) => i === 1 || i === 5 || i === 12)) {
        const a = await rpc<{ id: string }>(b.staff, "book_appointment", {
          p_practitioner: practitioner,
          p_starts_at: s.starts_at,
          p_customer_label: labels[n++ % labels.length],
          p_phone_e164: n % 3 === 0 ? `+23769900${String(10000 + n).slice(1)}` : null,
          p_consent: n % 3 === 0,
        });
        booked.push(a.id);
      }
    }
  }
  // États variés : arrivé, annulé.
  await rpc(b.staff, "check_in_appointment", { p_appointment: booked[0] });
  await rpc(b.staff, "cancel_appointment", { p_appointment: booked[2] });
  return { ...b, ...docs };
}

async function open(browser: Browser, size: Size, theme: "light" | "dark") {
  const s = SIZES[size];
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    isMobile: s.isMobile,
    hasTouch: s.isMobile,
    locale: "fr-FR",
  });
  return { context, page: await context.newPage() };
}

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots rendez-vous M5b ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.setTimeout(120_000);
    const b = await prepare();
    for (const theme of size === "mobile" || size === "desktop" ? (["light", "dark"] as const) : (["light"] as const)) {
      const { context, page } = await open(browser, size, theme);
      const path = `/desk/reception/${b.branchId}/appointments`;
      await page.goto(`/login?next=${encodeURIComponent(path)}`);
      await signInViaUi(page, b.email);
      await page.waitForURL((u) => u.pathname === path);
      await page.getByRole("button", { name: /M\.N\./ }).waitFor();
      if (size === "desktop" || size === "tablet-landscape") await page.getByRole("button", { name: /M\.N\./ }).click();
      await shot(page, `01-day-${size}-${theme}`);

      await page.getByRole("radio", { name: "Semaine" }).click();
      await page.getByRole("heading", { name: /^Semaine du / }).waitFor();
      await shot(page, `02-week-${size}-${theme}`);

      if (theme === "light") {
        await page.getByRole("radio", { name: "Jour" }).click();
        await page.getByRole("button", { name: "Nouveau rendez-vous" }).last().click();
        await page.getByRole("radiogroup", { name: "Créneaux libres" }).getByRole("radio").nth(1).click();
        await shot(page, `03-booking-${size}-${theme}`);
        if (size === "mobile" || size === "tablet-portrait") {
          await page.keyboard.press("Escape");
          await page.getByRole("button", { name: /A\.T\./ }).first().click();
          await page.getByRole("dialog").getByRole("button", { name: "Reprogrammer" }).waitFor();
          await shot(page, `04-detail-${size}-${theme}`);
          await page.keyboard.press("Escape");
        }

        await page.goto(`/app/o/${b.orgId}/practitioners/${b.abena}/schedule`);
        await page.getByRole("heading", { name: "Horaires et congés" }).waitFor();
        await shot(page, `05-schedule-${size}-${theme}`);
        if (size === "mobile" || size === "desktop") {
          await page.goto(`/app/o/${b.orgId}/branches/${b.branchId}/settings`);
          await page.getByRole("radio", { name: "Alterner" }).waitFor();
          await page.getByText("Rendez-vous", { exact: true }).scrollIntoViewIfNeeded();
          await shot(page, `06-fairness-${size}-${theme}`);
        }
        if (size === "mobile") {
          await page.goto(`/desk/counter/${b.counterId}`);
          await page.getByRole("button", { name: /Rendez-vous du jour/ }).click();
          await page.getByRole("dialog").waitFor();
          await shot(page, `07-desk-today-${size}-${theme}`);
        }
      }
      await context.close();
    }
  });
}
