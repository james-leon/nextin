import { expect, test } from "@playwright/test";

// LOT 4 (A1) : le fond du remplissage automatique de Chrome / Edge ne masque plus le libellé des champs groupés.
// Le remplissage réel ne se déclenche pas en test : on vérifie la règle CSS et que le libellé est au premier plan.
for (const theme of ["light", "dark"] as const) {
  test(`remplissage automatique : libellés lisibles, fond de la cellule (${theme})`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: theme });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("dr.ekwalla@clinique.cm");
    for (const name of ["E-mail", "Mot de passe"]) {
      const label = page.locator("label", { hasText: new RegExp(`^${name}$`) }).first();
      // Le point central du libellé appartient au libellé, pas au champ posé dessous.
      const onTop = await label.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      });
      expect(onTop, name).toBe(true);
    }
    // Règle de remplissage : fond = couleur de la cellule (jeton), texte = couleur du libellé.
    const rule = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        const walk = (list: CSSRuleList): string | null => {
          for (const r of Array.from(list)) {
            if (r instanceof CSSStyleRule && r.selectorText.includes(":-webkit-autofill")) return r.cssText;
            if ("cssRules" in r && (r as CSSGroupingRule).cssRules) {
              const found = walk((r as CSSGroupingRule).cssRules);
              if (found) return found;
            }
          }
          return null;
        };
        const found = walk(rules);
        if (found) return found;
      }
      return null;
    });
    expect(rule).toContain("--bg-grouped-secondary");
    expect(rule).toContain("inset");
    await context.close();
  });
}
