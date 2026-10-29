import { describe, expect, it } from "vitest";
import type { DeskSnapshot, DeskTicket } from "./desk";
import { deskShortcut, shortcutTargetAllowed } from "./shortcuts";

const t = (status: DeskTicket["status"]): DeskTicket => ({
  id: "t1",
  code: "C-001",
  status,
  serviceId: "s1",
  priorityLevel: 0,
  priorityReason: null,
  sortKey: 1,
  number: 1,
  preferredCounterId: null,
  source: "qr",
  createdAt: "2026-10-27T08:00:00.000Z",
  calledAt: null,
  servingStartedAt: null,
  recallCount: 0,
});
const s = (extra: Partial<Pick<DeskSnapshot, "counterStatus" | "current" | "waiting">> = {}) => ({
  counterStatus: "open" as const,
  current: null,
  waiting: [t("waiting")],
  ...extra,
});
const key = (k: string, extra = {}) => ({ key: k, ...extra });

describe("deskShortcut", () => {
  it("Espace suit l'action principale, sauf « Admettre » (réservé à Entrée) et sans personne en attente", () => {
    expect(deskShortcut(key(" "), s())).toBe("primary");
    expect(deskShortcut(key(" "), s({ counterStatus: "closed" }))).toBe("primary");
    expect(deskShortcut(key(" "), s({ current: t("serving") }))).toBe("primary");
    expect(deskShortcut(key(" "), s({ current: t("called") }))).toBeNull();
    expect(deskShortcut(key(" "), s({ waiting: [] }))).toBeNull();
  });
  it("Entrée, R et A seulement pour un patient alerté ; T dès qu'un patient est en cours", () => {
    expect(deskShortcut(key("Enter"), s({ current: t("called") }))).toBe("admit");
    expect(deskShortcut(key("Enter"), s({ current: t("serving") }))).toBeNull();
    expect(deskShortcut(key("r"), s({ current: t("called") }))).toBe("recall");
    expect(deskShortcut(key("R"), s({ current: t("serving") }))).toBeNull();
    expect(deskShortcut(key("a"), s({ current: t("called") }))).toBe("absent");
    expect(deskShortcut(key("t"), s({ current: t("serving") }))).toBe("transfer");
    expect(deskShortcut(key("t"), s())).toBeNull();
  });
  it("P : pause sans patient en cours, reprise en pause, rien poste fermé", () => {
    expect(deskShortcut(key("p"), s())).toBe("pause");
    expect(deskShortcut(key("p"), s({ current: t("serving") }))).toBeNull();
    expect(deskShortcut(key("p"), s({ counterStatus: "paused" }))).toBe("resume");
    expect(deskShortcut(key("p"), s({ counterStatus: "closed" }))).toBeNull();
  });
  it("aide, touches inconnues et combinaisons avec Ctrl, Cmd ou Alt", () => {
    expect(deskShortcut(key("?"), s())).toBe("help");
    expect(deskShortcut(key("x"), s())).toBeNull();
    expect(deskShortcut(key("r", { ctrlKey: true }), s({ current: t("called") }))).toBeNull();
    expect(deskShortcut(key(" ", { metaKey: true }), s())).toBeNull();
  });
});

describe("shortcutTargetAllowed", () => {
  it("jamais pendant une saisie ni avec une feuille ouverte", () => {
    expect(shortcutTargetAllowed({ tagName: "INPUT" }, false, "r")).toBe(false);
    expect(shortcutTargetAllowed({ tagName: "DIV", isContentEditable: true }, false, "r")).toBe(false);
    expect(shortcutTargetAllowed({ tagName: "BODY" }, true, "r")).toBe(false);
    expect(shortcutTargetAllowed({ tagName: "BODY" }, false, " ")).toBe(true);
  });
  it("sur un bouton : lettres permises, Espace et Entrée gardent leur rôle natif", () => {
    expect(shortcutTargetAllowed({ tagName: "BUTTON" }, false, "r")).toBe(true);
    expect(shortcutTargetAllowed({ tagName: "BUTTON" }, false, " ")).toBe(false);
    expect(shortcutTargetAllowed({ tagName: "A" }, false, "Enter")).toBe(false);
  });
});
