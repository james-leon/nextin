import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixtures from "./fairness.fixtures.json";
import { pickNextTicket, type FairnessMode } from "./fairness";

describe("règle d'équité rendez-vous / sans rendez-vous", () => {
  it.each(fixtures)("$name", ({ mode, ratio, early, since, now, candidates, expected }) => {
    expect(
      pickNextTicket(
        candidates.map((c) => ({ id: c.id, appointmentStartsAt: c.at })),
        { mode: mode as FairnessMode, walkinRatio: ratio, earlyMinutes: early },
        since,
        new Date(now),
      ),
    ).toBe(expected);
  });

  it("parité : les cas de référence sont rejoués à l'identique par pgTAP contre public.fair_pick", () => {
    const sql = readFileSync(new URL("../../../../supabase/tests/database/m5b_appointments.test.sql", import.meta.url), "utf8");
    const embedded = sql.match(/\$fixtures\$([\s\S]*?)\$fixtures\$/)?.[1];
    expect(embedded && JSON.parse(embedded)).toEqual(fixtures);
  });
});
