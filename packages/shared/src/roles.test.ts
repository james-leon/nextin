import { describe, expect, it } from "vitest";
import { canAssignRole, hasAtLeast, isMemberRole } from "./roles";

describe("roles", () => {
  it("org_admin peut tout attribuer", () => {
    expect(canAssignRole("org_admin", "org_admin")).toBe(true);
    expect(canAssignRole("org_admin", "agent")).toBe(true);
  });
  it("branch_manager n'attribue que des rôles inférieurs", () => {
    expect(canAssignRole("branch_manager", "receptionist")).toBe(true);
    expect(canAssignRole("branch_manager", "agent")).toBe(true);
    expect(canAssignRole("branch_manager", "branch_manager")).toBe(false);
    expect(canAssignRole("branch_manager", "org_admin")).toBe(false);
  });
  it("le personnel de terrain n'attribue rien", () => {
    expect(canAssignRole("receptionist", "agent")).toBe(false);
    expect(canAssignRole("agent", "receptionist")).toBe(false);
  });
  it("hasAtLeast / isMemberRole", () => {
    expect(hasAtLeast("org_admin", "branch_manager")).toBe(true);
    expect(hasAtLeast("agent", "branch_manager")).toBe(false);
    expect(isMemberRole("agent")).toBe(true);
    expect(isMemberRole("super_admin")).toBe(false);
  });
});
