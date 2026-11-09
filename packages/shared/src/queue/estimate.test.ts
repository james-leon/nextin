import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fixtures from "./estimate.fixtures.json";
import { effectiveDurationSeconds, estimateWaitSeconds, nextEwma, waitMinutes } from "./estimate";

describe("estimateWaitSeconds (cas partagés avec SQL)", () => {
  it.each(fixtures)("ahead=$ahead durations=$durations busy=$busy → $expected s", ({ ahead, durations, busy, expected }) => {
    const counters = durations.map((d, i) => ({ durationSeconds: d, busyRemainingSeconds: busy[i]! }));
    expect(estimateWaitSeconds(ahead, counters)).toBe(expected);
  });

  it("pgTAP vérifie exactement les mêmes cas", () => {
    const sql = readFileSync(fileURLToPath(new URL("../../../../supabase/tests/database/m3_queue.test.sql", import.meta.url)), "utf8");
    for (const f of fixtures) {
      const call = `public.estimate_wait_seconds(${f.ahead}, array[${f.durations.join(", ")}]::numeric[], array[${f.busy.join(", ")}]::numeric[]), ${f.expected},`;
      expect(sql, call).toContain(call);
    }
  });

  it("aucun poste : 0", () => {
    expect(estimateWaitSeconds(3, [])).toBe(0);
  });
});

describe("effectiveDurationSeconds", () => {
  it("durée par défaut tant que l'historique est insuffisant", () => {
    expect(effectiveDurationSeconds(600, 300, 0)).toBe(600);
    expect(effectiveDurationSeconds(600, 300, 9)).toBe(600);
    expect(effectiveDurationSeconds(600, null, 50)).toBe(600);
  });
  it("mélange progressif puis moyenne mesurée", () => {
    expect(effectiveDurationSeconds(600, 300, 10)).toBe(600);
    expect(effectiveDurationSeconds(600, 300, 20)).toBe(450);
    expect(effectiveDurationSeconds(600, 300, 30)).toBe(300);
    expect(effectiveDurationSeconds(600, 300, 200)).toBe(300);
  });
});

describe("nextEwma", () => {
  it("premier passage, lissage, valeurs aberrantes ignorées", () => {
    expect(nextEwma(null, 0, 300)).toBe(300);
    expect(nextEwma(300, 5, 400)).toBe(320);
    expect(nextEwma(300, 5, 10)).toBeNull();
    expect(nextEwma(300, 12, 1300)).toBeNull();
    expect(nextEwma(300, 5, 1300)).toBe(500);
  });
  it("minutes affichées", () => {
    expect(waitMinutes(0)).toBe(0);
    expect(waitMinutes(20)).toBe(1);
    expect(waitMinutes(61)).toBe(2);
    expect(waitMinutes(720)).toBe(12);
  });
});
