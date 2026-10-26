import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Douala2026test";

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@nextin.test`;
}

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function expectTouchTargets(page: Page) {
  const tooSmall = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main button, main a[href], main [role=switch], main input:not([type=hidden])"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const before = getComputedStyle(el, "::before");
        const h = Math.max(r.height, before.content !== "none" ? parseFloat(before.height) || 0 : 0);
        return { label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30), w: r.width, h, input: el.tagName === "INPUT" };
      })
      .filter((t) => t.h < 44 || (!t.input && t.w < 44)),
  );
  expect(tooSmall).toEqual([]);
}

export async function signUpViaUi(
  page: Page,
  { name, email, next, expectSuccess = true }: { name: string; email: string; next?: string; expectSuccess?: boolean },
) {
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  await page.getByLabel("Nom complet").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  if (expectSuccess) await page.waitForURL((url) => url.pathname !== "/signup");
}

export async function signInViaUi(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}
