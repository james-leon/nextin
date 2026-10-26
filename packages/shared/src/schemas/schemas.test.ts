import { describe, expect, it } from "vitest";
import { createOrganizationSchema, inviteMemberSchema, loginCodeVerifySchema, newOrganizationFormSchema, signupSchema } from "./index";

describe("schemas", () => {
  it("createOrganization applique les valeurs par défaut", () => {
    const v = createOrganizationSchema.parse({ name: "Douala Clinic", slug: "douala-clinic", type: "clinic" });
    expect(v.defaultLocale).toBe("fr");
    expect(v.dataRetentionDays).toBe(30);
  });
  it("createOrganization rejette un slug invalide et une rétention hors bornes", () => {
    expect(createOrganizationSchema.safeParse({ name: "X Y", slug: "Douala Clinic", type: "clinic" }).success).toBe(false);
    expect(
      createOrganizationSchema.safeParse({ name: "Eneo", slug: "eneo", type: "utility", dataRetentionDays: 2 }).success,
    ).toBe(false);
  });
  it("inviteMember exige un contact et normalise le téléphone", () => {
    const id = "6f1c1d2e-8a3b-4c5d-9e6f-7a8b9c0d1e2f";
    expect(inviteMemberSchema.safeParse({ organizationId: id, role: "agent" }).success).toBe(false);
    const v = inviteMemberSchema.parse({ organizationId: id, role: "agent", phone: "6 77 12 34 56" });
    expect(v.phone).toBe("+237677123456");
    expect(v.branchId).toBeNull();
  });
});

describe("auth schemas", () => {
  it("inscription : mot de passe de 10 caractères avec lettres et chiffres", () => {
    const base = { fullName: "Dr Ngo Biyong", email: " Directeur@DoualaClinic.CM " };
    expect(signupSchema.safeParse({ ...base, password: "court1" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "seulementdeslettres" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "1234567890" }).success).toBe(false);
    const ok = signupSchema.parse({ ...base, password: "Douala2026ok" });
    expect(ok.email).toBe("directeur@doualaclinic.cm");
  });
  it("code de connexion à 6 chiffres", () => {
    expect(loginCodeVerifySchema.safeParse({ email: "a@b.cm", code: "123456" }).success).toBe(true);
    expect(loginCodeVerifySchema.safeParse({ email: "a@b.cm", code: "12345a" }).success).toBe(false);
  });
  it("nouvel établissement : secteur requis, langue FR par défaut", () => {
    expect(newOrganizationFormSchema.safeParse({ name: "Eneo" }).success).toBe(false);
    expect(newOrganizationFormSchema.parse({ name: "Eneo Bonanjo", type: "utility" }).defaultLocale).toBe("fr");
  });
});

describe("M2 schemas", () => {
  it("service : préfixe en majuscules, durée en minutes, quota facultatif", async () => {
    const { serviceFormSchema } = await import("./index");
    const v = serviceFormSchema.parse({
      name: "Consultation générale",
      prefix: "c",
      color: "#1A6BB5",
      defaultMinutes: "10",
      maxDailyTickets: "",
      specialtyId: "",
      allowPriority: "on",
    });
    expect(v).toMatchObject({ prefix: "C", defaultMinutes: 10, maxDailyTickets: null, specialtyId: null, allowPriority: true, allowRemote: false });
    expect(serviceFormSchema.safeParse({ name: "X", prefix: "C1", color: "#1A6BB5", defaultMinutes: "0" }).success).toBe(false);
  });
  it("horaires : fermeture après ouverture pour les jours ouverts", async () => {
    const { openingHoursSchema } = await import("./index");
    const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: weekday < 6, opensAt: "07:30", closesAt: "17:00" }));
    expect(openingHoursSchema.safeParse(days).success).toBe(true);
    days[0] = { weekday: 1, open: true, opensAt: "18:00", closesAt: "08:00" };
    expect(openingHoursSchema.safeParse(days).success).toBe(false);
    days[0] = { weekday: 1, open: false, opensAt: "18:00", closesAt: "08:00" };
    expect(openingHoursSchema.safeParse(days).success).toBe(true);
  });
  it("invitation : un responsable d'agence exige une agence", async () => {
    const { inviteFormSchema } = await import("./index");
    expect(inviteFormSchema.safeParse({ role: "branch_manager", email: "a@b.cm", branchId: "" }).success).toBe(false);
    expect(inviteFormSchema.safeParse({ role: "agent", email: "a@b.cm", branchId: "" }).success).toBe(true);
    expect(inviteFormSchema.safeParse({ role: "org_admin", email: "a@b.cm", branchId: "6f1c1d2e-8a3b-4c5d-9e6f-7a8b9c0d1e2f" }).success).toBe(false);
  });
  it("agence : téléphone camerounais normalisé, coordonnées facultatives", async () => {
    const { branchFormSchema } = await import("./index");
    const v = branchFormSchema.parse({ name: "Akwa", address: "", city: "Douala", phone: "6 77 12 34 56", lat: "", lng: "" });
    expect(v).toMatchObject({ name: "Akwa", address: null, city: "Douala", phone: "+237677123456" });
    expect(v.lat).toBeUndefined();
    expect(branchFormSchema.safeParse({ name: "Akwa", phone: "12345" }).success).toBe(false);
  });
});
