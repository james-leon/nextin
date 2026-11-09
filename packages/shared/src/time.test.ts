import { describe, expect, it } from "vitest";
import { formatElapsed } from "./time";

describe("formatElapsed", () => {
  it.each([
    [0, "00:00"],
    [252, "04:12"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3725.9, "1:02:05"],
    [-5, "00:00"],
  ])("%s s → %s", (s, expected) => {
    expect(formatElapsed(s)).toBe(expected);
  });
});
