import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

/** Une journée en cours : trois tickets, un patient servi au cabinet 3. */
async function prepare() {
  const b = await setUpBranch("Clinique Stats");
  for (let i = 0; i < 3; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
  const first = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: b.counterId });
  await rpc(b.staff, "admit_ticket", { p_ticket: first.id });
  await rpc(b.staff, "finish_ticket", { p_ticket: first.id });
  return b;
}

async function open(page: Page, b: Awaited<ReturnType<typeof prepare>>) {
  const path = `/app/o/${b.orgId}`;
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await signInViaUi(page, b.email);
  await page.waitForURL((u) => u.pathname === path);
  await expect(page.getByRole("heading", { name: "Aujourd'hui", level: 1 })).toBeVisible();
}

const kpi = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("..");

test.describe("M8 — tableau de bord", () => {
  test("ordinateur : indicateurs, direct, semaine, export CSV, démarrage", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "vue ordinateur");
    const b = await prepare();
    await open(page, b);

    await expect(kpi(page, "Tickets émis")).toContainText("3");
    await expect(page.getByRole("region", { name: "Files en direct" })).toContainText("Consultation");
    await expect(page.getByRole("region", { name: "Files en direct" })).toContainText("2 en attente");
    const counters = page.getByRole("region", { name: "Postes" });
    await expect(counters.getByRole("row", { name: /Cabinet 3/ })).toContainText("1");
    await expect(page.getByRole("region", { name: "Affluence par heure" }).getByRole("table")).toHaveCount(1);
    await expectAccessible(page);

    // En direct : un nouveau ticket met à jour les indicateurs sans recharger la page.
    await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await expect(kpi(page, "Tickets émis")).toContainText("4", { timeout: 15_000 });

    await page.getByRole("radio", { name: "Semaine" }).click();
    await expect(page.getByRole("heading", { name: "Cette semaine", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tickets par jour" })).toBeVisible();
    await expect(kpi(page, "Tickets émis")).toContainText("4");

    // Export CSV (format Excel français).
    await page.getByRole("button", { name: "Exporter" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("link", { name: /Par jour et par service/ }).click();
    const file = await (await download).path();
    const csv = readFileSync(file!, "utf8");
    expect(csv.startsWith("﻿Jour;Agence;Service;Lettre;Tickets émis;Servis")).toBe(true);
    expect(csv).toMatch(/;Akwa;Consultation;C;4;1;/);
    await page.keyboard.press("Escape");

    // Configuration incomplète : accès au démarrage.
    await page.getByRole("link", { name: /Configuration : \d étapes sur 4/ }).click();
    await expect(page.getByRole("heading", { name: "Démarrage", level: 1 })).toBeVisible();
  });

  test("droits : un agent n'a pas de tableau de bord, l'export lui est refusé", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "vue ordinateur");
    const b = await prepare();
    const email = uniqueEmail("agent");
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    expect(created.error).toBeNull();
    await admin.from("memberships").insert({ organization_id: b.orgId, user_id: created.data.user!.id, role: "agent", branch_id: b.branchId });
    const path = `/app/o/${b.orgId}`;
    await page.goto(`/login?next=${encodeURIComponent(path)}`);
    await signInViaUi(page, email);
    await page.waitForURL((u) => u.pathname === path);
    await expect(page.getByRole("heading", { name: "Vue d'ensemble", level: 1 })).toBeVisible();
    await expect(page.getByText("Tickets émis")).toHaveCount(0);
    const today = new Date().toISOString().slice(0, 10);
    const res = await page.request.get(`/app/o/${b.orgId}/dashboard/export?kind=services&from=${today}&to=${today}`);
    expect(res.status()).toBe(403);
  });

  test("téléphone : une colonne, cibles tactiles, accessibilité", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "vue téléphone");
    const b = await prepare();
    await open(page, b);
    await expect(kpi(page, "Tickets émis")).toContainText("3");
    await expectTouchTargets(page);
    await expectAccessible(page);
    await page.getByRole("radio", { name: "Mois" }).click();
    await expect(page.getByRole("heading", { name: "Ce mois-ci", level: 1 })).toBeVisible();
    await expectAccessible(page);
  });
});
