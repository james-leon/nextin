import { describe, expect, it } from "vitest";
import { ORG_TYPES, adminCreateOrganizationSchema } from "./schemas";
import { SERVICE_TEMPLATES, templateServices } from "./service-templates";
import { invitationEmail } from "./notifications/invitation-email";

describe("SERVICE_TEMPLATES", () => {
  it("couvre chaque secteur, avec des préfixes et des clés uniques valides pour la base", () => {
    for (const type of ORG_TYPES) {
      const list = SERVICE_TEMPLATES[type];
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(12);
      expect(new Set(list.map((s) => s.prefix)).size).toBe(list.length);
      expect(new Set(list.map((s) => s.key)).size).toBe(list.length);
      for (const s of list) {
        expect(s.prefix).toMatch(/^[A-Z]{1,2}$/);
        expect(s.key).toMatch(/^[a-z_]{2,30}$/);
        expect(s.minutes * 60).toBeGreaterThanOrEqual(60);
        expect(s.minutes * 60).toBeLessThanOrEqual(7200);
        expect(s.name.fr.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("templateServices garde l'ordre du modèle, ignore les clés inconnues et donne la couleur en hexadécimal", () => {
    expect(templateServices("clinic", ["pharmacy", "inconnu", "consultation"])).toEqual([
      { name: "Consultation", name_en: "Consultation", prefix: "C", seconds: 900, color: "#1A6BB5" },
      { name: "Pharmacie", name_en: "Pharmacy", prefix: "P", seconds: 300, color: "#8E5BB5" },
    ]);
  });
});

describe("adminCreateOrganizationSchema", () => {
  const base = {
    name: "Clinique Bonamoussadi",
    type: "clinic",
    locale: "fr",
    planId: "754f307f-0c36-4710-b036-e45f0f28e6df",
    trialDays: "30",
    ownerEmail: " Directrice@Clinique.CM ",
    ownerPhone: "",
    branchName: "Bonamoussadi",
    branchCity: "",
    services: ["consultation"],
    reason: "Contrat signé",
  };
  it("normalise l'adresse, convertit la durée et rend le téléphone facultatif", () => {
    const r = adminCreateOrganizationSchema.parse(base);
    expect(r.ownerEmail).toBe("directrice@clinique.cm");
    expect(r.trialDays).toBe(30);
    expect(r.ownerPhone).toBeUndefined();
    expect(r.branchCity).toBeNull();
  });
  it("refuse un essai hors bornes et un motif vide", () => {
    const r = adminCreateOrganizationSchema.safeParse({ ...base, trialDays: "0", reason: "" });
    expect(r.success).toBe(false);
    const codes = r.error!.issues.map((i) => i.message);
    expect(codes).toContain("trial_days_invalid");
    expect(codes).toContain("reason_required");
  });
  it("met le téléphone au format E.164", () => {
    expect(adminCreateOrganizationSchema.parse({ ...base, ownerPhone: "690 11 22 33" }).ownerPhone).toBe("+237690112233");
  });
});

describe("invitationEmail", () => {
  const link = "https://nextin.example/invite/abc";
  it("FR : objet, lien et durée de validité ; une seule action", () => {
    const m = invitationEmail("fr", { organization: "Clinique A", role: "org_admin", link, validDays: 7, byWintek: true });
    expect(m.subject).toBe("Invitation à rejoindre Clinique A sur NextIn");
    expect(m.text).toContain(link);
    expect(m.text).toContain("valable 7 jours");
    expect(m.text).toContain("Wintek a créé l'espace NextIn");
    expect(m.html.match(/<a /g)?.length).toBe(1);
  });
  it("EN : rôle traduit, nom échappé dans le HTML", () => {
    const m = invitationEmail("en", { organization: "A & <B>", role: "receptionist", link, validDays: 7 });
    expect(m.text).toContain("as receptionist");
    expect(m.html).toContain("A &amp; &lt;B&gt;");
    expect(m.html).not.toContain("<B>");
  });
});
