import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "./ip";

describe("ip", () => {
  it("lit la première IP de X-Forwarded-For", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "41.202.1.2, 10.0.0.1" }))).toBe("41.202.1.2");
    expect(clientIp(new Headers({ "x-real-ip": "41.202.1.3" }))).toBe("41.202.1.3");
    expect(clientIp(new Headers())).toBeNull();
  });
  it("hache de façon stable et salée", () => {
    expect(hashIp("1.1.1.1", "salt-a")).toBe(hashIp("1.1.1.1", "salt-a"));
    expect(hashIp("1.1.1.1", "salt-a")).not.toBe(hashIp("1.1.1.1", "salt-b"));
    expect(hashIp("1.1.1.1", "salt-a")).toMatch(/^[0-9a-f]{64}$/);
  });
});
