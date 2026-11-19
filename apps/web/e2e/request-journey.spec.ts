import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";
import { addDoctors, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

// LOT 5a (B10) — parcours de demande de rendez-vous sur téléphone Android : aucun débordement horizontal (barre du bas
// entière), coordonnées en liste groupée, code en six cases, « Renvoyer le code » après 60 s avec compte à rebours qui
// reprend après rechargement (et refusé par la base avant).
test.describe("demande de rendez-vous — téléphone", () => {
  test("360, 390 et 412 px : rien ne déborde ; code en cases ; renvoi après 60 s", async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "téléphone");
    test.setTimeout(120_000);
    const b = await setUpBranch(`Demande mobile ${Date.now()}`);
    await b.staff.from("branch_settings").update({ appointment_requests_enabled: true }).eq("branch_id", b.branchId).select("branch_id");
    const { abena } = await addDoctors(b);
    const { error } = await b.staff.from("practitioner_schedules").insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        organization_id: b.orgId,
        branch_id: b.branchId,
        practitioner_id: abena,
        service_id: b.serviceId,
        weekday,
        starts_at: "08:00",
        ends_at: "12:00",
        slot_minutes: 30,
      })),
    );
    expect(error).toBeNull();

    let token = "";
    for (const width of [360, 390, 412]) {
      const context = await browser.newContext({
        viewport: { width, height: 800 },
        isMobile: true,
        hasTouch: true,
        locale: "fr-FR",
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
      });
      const page = await context.newPage();
      await page.goto(`/b/${b.branchId}/rdv`);
      await page.getByRole("radio", { name: "Dr Abena" }).click();
      await page.getByRole("radiogroup", { name: "Jour" }).getByRole("radio").nth(1).click();
      await page.getByRole("radiogroup", { name: "Créneau" }).getByRole("radio", { name: "08:30" }).click();
      await page.getByLabel("Adresse e-mail").fill(`mobile.${width}.${Date.now()}@exemple.cm`);
      // Aucun débordement horizontal ; le bouton d'envoi de la barre du bas reste entier dans l'écran.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width} px : débordement horizontal`).toBeLessThanOrEqual(0);
      const send = page.getByRole("button", { name: "Envoyer la demande" }).filter({ visible: true });
      const box = (await send.boundingBox())!;
      expect(box.x, `${width} px : bouton à gauche de l'écran`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${width} px : bouton hors écran`).toBeLessThanOrEqual(width);
      const summary = await page.evaluate(() => {
        const p = document.querySelector<HTMLElement>(".safe-bottom p");
        return p ? { cut: p.scrollWidth > p.clientWidth + 1, right: p.getBoundingClientRect().right } : null;
      });
      if (summary) {
        expect(summary.cut, `${width} px : récapitulatif coupé`).toBe(false);
        expect(summary.right).toBeLessThanOrEqual(width);
      }
      // Coordonnées : e-mail et téléphone dans une même liste groupée, comme le nom.
      await expect(page.getByLabel("Téléphone (facultatif)")).toBeVisible();
      if (width === 390) {
        await expectAccessible(page);
        await send.click();
        await page.waitForURL(/\/r\/[A-Za-z0-9]{22}$/);
        token = page.url().split("/r/")[1]!;
        // Code en six cases ; renvoi bloqué 60 s avec compte à rebours.
        await expect(page.getByLabel("Code de vérification")).toHaveAttribute("autocomplete", "one-time-code");
        const resend = page.getByRole("button", { name: /^Renvoyer dans 0:[0-5]\d$/ });
        await expect(resend).toBeDisabled();
        await page.reload();
        await expect(page.getByRole("button", { name: /^Renvoyer dans 0:[0-5]\d$/ })).toBeDisabled();
        await expectAccessible(page);
        // La base refuse aussi un renvoi trop tôt (même sans l'écran).
        const early = await page.request.post("/api/appointment-requests/resend", { data: { token } });
        expect(await early.json()).toMatchObject({ ok: false, error: "rate_limited" });
        // Une minute plus tard (expiration du code reculée) : bouton actif, nouveau code, nouveau compte à rebours.
        const { data: row } = await admin.from("appointment_requests").select("id, code_expires_at").eq("public_token", token).single();
        await admin
          .from("appointment_requests")
          .update({ code_expires_at: new Date(new Date(row!.code_expires_at!).getTime() - 61_000).toISOString() })
          .eq("id", row!.id);
        await page.reload();
        await page.getByRole("button", { name: "Renvoyer le code" }).click();
        await expect(page.getByText("Nouveau code envoyé.")).toBeVisible();
        await expect(page.getByRole("button", { name: /^Renvoyer dans 0:[0-5]\d$/ })).toBeDisabled();
      }
      await context.close();
    }
    expect(token).not.toBe("");
  });
});
