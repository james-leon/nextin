import { describe, expect, it } from "vitest";
import { adFileUrl } from "@nextin/shared/ads";
import { safeMediaSrc } from "./media-src";

const SUPABASE = "https://abcd.supabase.co";

describe("safeMediaSrc (aperçu des publicités)", () => {
  it("accepte un fichier choisi sur l'appareil (blob:) et un fichier du bucket ad-creatives", () => {
    expect(safeMediaSrc("blob:https://nextin.example/4f1c2d3e-0000-4000-8000-000000000000", SUPABASE)).toBe(
      "blob:https://nextin.example/4f1c2d3e-0000-4000-8000-000000000000",
    );
    const file = adFileUrl(SUPABASE, "adv/camp/visuel été.png");
    expect(safeMediaSrc(file, SUPABASE)).toBe(file);
    expect(safeMediaSrc(adFileUrl("http://127.0.0.1:54321", "a/b/c.png"), "http://127.0.0.1:54321")).not.toBeNull();
  });

  it("refuse javascript:, data:, un autre domaine, un autre bucket et une remontée de dossier", () => {
    expect(safeMediaSrc("javascript:alert(1)", SUPABASE)).toBeNull();
    expect(safeMediaSrc("data:image/svg+xml,<svg onload=alert(1)>", SUPABASE)).toBeNull();
    expect(safeMediaSrc("blob:javascript:alert(1)", SUPABASE)).toBeNull();
    expect(safeMediaSrc("https://evil.example/storage/v1/object/public/ad-creatives/x.png", SUPABASE)).toBeNull();
    expect(safeMediaSrc(`${SUPABASE}/storage/v1/object/public/ad-documents/x.pdf`, SUPABASE)).toBeNull();
    expect(safeMediaSrc(`${SUPABASE}/storage/v1/object/public/ad-creatives/../ad-documents/x.pdf`, SUPABASE)).toBeNull();
    expect(safeMediaSrc(`${SUPABASE}/storage/v1/object/public/ad-creatives/`, SUPABASE)).toBeNull();
    expect(safeMediaSrc("", SUPABASE)).toBeNull();
    expect(safeMediaSrc(null, SUPABASE)).toBeNull();
    expect(safeMediaSrc("pas une adresse", SUPABASE)).toBeNull();
    expect(safeMediaSrc(adFileUrl(SUPABASE, "a/b.png"), null)).toBeNull();
  });
});
