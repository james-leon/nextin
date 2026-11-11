import { describe, expect, it } from "vitest";
import { SECURITY_ALERT_KINDS, deviceLabel, securityAlertEmail } from "./alerts";

describe("alertes de sécurité (S3)", () => {
  it("chaque alerte a un objet et un texte en français et en anglais, avec la marche à suivre", () => {
    for (const kind of SECURITY_ALERT_KINDS) {
      for (const locale of ["fr", "en"] as const) {
        const mail = securityAlertEmail(kind, locale, { device: "Chrome · Windows", account: "d•••@clinique.cm", organization: "DOUALA CLINIC" });
        expect(mail.subject).toMatch(/^NextIn/);
        expect(mail.text).toContain("contact@wintekservices.com");
      }
    }
  });
  it("le texte reprend le détail utile, jamais un identifiant", () => {
    expect(securityAlertEmail("login_failures", "fr", { account: "d•••@clinique.cm", failures: 10, window_minutes: 15 }).text).toContain(
      "10 tentatives de connexion ont échoué en 15 minutes sur le compte d•••@clinique.cm",
    );
    expect(securityAlertEmail("mfa_disabled", "en", { by: "admin" }).text).toContain("reset by Wintek support");
  });
  it("appareil : navigateur et système seulement", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome · Windows");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari · iOS");
    expect(deviceLabel(null)).toBe("Navigateur");
  });
});
