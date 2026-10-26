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
