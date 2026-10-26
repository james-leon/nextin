import { describe, expect, it } from "vitest";
import { createOrganizationSchema, inviteMemberSchema } from "./index";

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
