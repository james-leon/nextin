import { describe, expect, it } from "vitest";
import { absoluteUrl, getAppUrl } from "./app-url";

describe("APP_URL", () => {
  it("lit APP_URL et retire le slash final", () => {
    expect(getAppUrl({ APP_URL: "https://nextin.example/" })).toBe("https://nextin.example");
    expect(absoluteUrl("q/abc", { APP_URL: "https://nextin.example" })).toBe("https://nextin.example/q/abc");
  });
  it("échoue si absente ou invalide", () => {
    expect(() => getAppUrl({})).toThrow();
    expect(() => getAppUrl({ APP_URL: "nextin.example" })).toThrow();
  });
});
