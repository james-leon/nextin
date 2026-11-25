import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_STATUS_TONE,
  CAMPAIGN_STEPS,
  campaignEditable,
  campaignEndsOn,
  campaignListLine,
  campaignNotice,
  campaignSummary,
  canOpenStep,
  firstIncompleteStep,
  gamesOffer,
  nextStep,
  packageBadges,
  previousStep,
  stepFromNumber,
  stepNumber,
  visibleCities,
} from "./campaign-wizard";

const ARGENT = { price_xaf: 40_000, duration_days: 14, max_branches: 15, surfaces: ["tv", "app", "game"], quiz_allowed: true, game_skin_allowed: false };
const BRONZE = { price_xaf: 15_000, duration_days: 7, max_branches: 5, surfaces: ["tv"], quiz_allowed: false, game_skin_allowed: false };
const OR = { price_xaf: 90_000, duration_days: 30, max_branches: null, surfaces: ["tv", "app", "game"], quiz_allowed: true, game_skin_allowed: true };

describe("étapes de la nouvelle campagne", () => {
  it("cinq étapes dans l'ordre de la maquette", () => {
    expect(CAMPAIGN_STEPS).toEqual(["package", "targeting", "creatives", "games", "submit"]);
    expect(CAMPAIGN_STEPS.map(stepNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(stepFromNumber("2")).toBe("targeting");
    expect(stepFromNumber(5)).toBe("submit");
    expect([0, 6, "x", "1.5", null, undefined, ""].map(stepFromNumber)).toEqual([null, null, null, null, null, null, null]);
  });

  it("retour vers l'étape précédente, suite vers la suivante", () => {
    expect(previousStep("package")).toBeNull();
    expect(previousStep("targeting")).toBe("package");
    expect(previousStep("submit")).toBe("games");
    expect(nextStep("games")).toBe("submit");
    expect(nextStep("submit")).toBeNull();
  });

  it("une campagne quittée rouvre à la première étape incomplète", () => {
    expect(firstIncompleteStep({ saved: false, creatives: 0 })).toBe("package");
    expect(firstIncompleteStep({ saved: true, creatives: 0 })).toBe("creatives");
    expect(firstIncompleteStep({ saved: true, creatives: 2 })).toBe("submit");
  });

  it("frise : étapes ouvertes selon l'avancement", () => {
    expect(canOpenStep("package", { saved: false, creatives: 0 })).toBe(true);
    expect(canOpenStep("targeting", { saved: false, creatives: 0 })).toBe(false);
    expect(canOpenStep("games", { saved: true, creatives: 0 })).toBe(true);
    expect(canOpenStep("submit", { saved: true, creatives: 0 })).toBe(false);
    expect(canOpenStep("submit", { saved: true, creatives: 1 })).toBe(true);
  });

  it("jeux proposés selon la formule (Bronze : aucun)", () => {
    expect(gamesOffer(BRONZE)).toBe("none");
    expect(gamesOffer(ARGENT)).toBe("quiz");
    expect(gamesOffer(OR)).toBe("quiz_skin");
  });

  it("pastilles des surfaces de chaque formule", () => {
    expect(packageBadges(BRONZE)).toEqual(["tv"]);
    expect(packageBadges(ARGENT)).toEqual(["tv", "app", "game", "quiz"]);
    expect(packageBadges(OR)).toEqual(["tv", "app", "game", "quiz", "skin"]);
  });
});

describe("récapitulatif", () => {
  it("période, villes, établissements, agences et total (maquette : Argent du 23 nov. au 6 déc.)", () => {
    const s = campaignSummary({ package: ARGENT, startsOn: "2026-11-23", cities: [], orgTypes: [] });
    expect(s.period).toEqual({ from: "2026-11-23", to: "2026-12-06" });
    expect(s.cities).toEqual([]);
    expect(s.orgTypes).toBe(0);
    expect(s.maxBranches).toBe(15);
    expect(s.total).toBe(40_000);
  });

  it("formule sans plafond : toutes les agences ; visuels et quiz comptés", () => {
    const s = campaignSummary({
      package: OR,
      startsOn: "2026-11-23",
      cities: ["Douala"],
      orgTypes: ["clinic", "hospital"],
      creatives: [{ kind: "image" }, { kind: "video" }, { kind: "image" }],
      quizQuestions: 3,
    });
    expect(s.maxBranches).toBeNull();
    expect(s.period?.to).toBe("2026-12-22");
    expect([s.images, s.videos, s.quizQuestions, s.orgTypes]).toEqual([2, 1, 3, 2]);
  });

  it("sans formule : ni période ni total", () => {
    const s = campaignSummary({ package: null, startsOn: "2026-11-23", cities: [], orgTypes: [] });
    expect(s.period).toBeNull();
    expect(s.total).toBeNull();
  });

  it("fin de diffusion incluse", () => {
    expect(campaignEndsOn("2026-11-23", 7)).toBe("2026-11-29");
    expect(campaignEndsOn("2026-11-23", 1)).toBe("2026-11-23");
    expect(campaignEndsOn("2026-02-27", 3)).toBe("2026-03-01");
  });

  it("villes : 4 visibles puis « + n », les cochées toujours montrées", () => {
    const all = ["Bafoussam", "Douala", "Garoua", "Kribi", "Limbé", "Yaoundé"];
    expect(visibleCities(all, [], false)).toEqual({ shown: ["Bafoussam", "Douala", "Garoua", "Kribi"], hidden: 2 });
    expect(visibleCities(all, ["Yaoundé"], false)).toEqual({ shown: ["Yaoundé", "Bafoussam", "Douala", "Garoua"], hidden: 2 });
    expect(visibleCities(all, [], true).hidden).toBe(0);
    expect(visibleCities(all, ["Yaoundé", "Limbé", "Kribi", "Garoua", "Douala"], false)).toEqual({
      shown: ["Yaoundé", "Limbé", "Kribi", "Garoua", "Douala"],
      hidden: 1,
    });
    expect(visibleCities(["Douala", "Kribi"], [], false)).toEqual({ shown: ["Douala", "Kribi"], hidden: 0 });
  });
});

describe("statuts", () => {
  it("couleurs : Diffusée vert, À payer orange, En validation bleu, Refusée rouge, le reste gris", () => {
    expect(CAMPAIGN_STATUS_TONE).toEqual({
      draft: "neutral",
      pending_review: "accent",
      rejected: "red",
      awaiting_payment: "orange",
      active: "green",
      paused: "neutral",
      ended: "neutral",
    });
  });

  it("une phrase par statut, avec un titre seulement pour « Campagne validée »", () => {
    expect(campaignNotice("active")).toEqual({ key: "active", tone: "green", title: false });
    expect(campaignNotice("awaiting_payment")).toEqual({ key: "awaiting_payment", tone: "orange", title: true });
    expect(campaignNotice("pending_review")).toEqual({ key: "pending_review", tone: "accent", title: false });
    expect(campaignNotice("rejected")).toEqual({ key: "rejected", tone: "red", title: false });
    expect(campaignNotice("paused").tone).toBe("neutral");
    expect(campaignNotice("ended").tone).toBe("neutral");
    expect(campaignNotice("draft").tone).toBe("neutral");
  });

  it("seconde ligne de la liste selon le statut", () => {
    expect(campaignListLine("active")).toBe("until");
    expect(campaignListLine("paused")).toBe("until");
    expect(campaignListLine("ended")).toBe("ended");
    expect(campaignListLine("awaiting_payment")).toBe("duration");
    expect(campaignListLine("draft")).toBe("duration");
  });

  it("« Modifier » seulement en brouillon ou après un refus", () => {
    const all = ["draft", "rejected", "pending_review", "awaiting_payment", "active", "paused", "ended"] as const;
    expect(all.map(campaignEditable)).toEqual([true, true, false, false, false, false, false]);
  });
});
