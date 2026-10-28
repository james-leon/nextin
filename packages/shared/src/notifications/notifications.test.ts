import { describe, expect, it } from "vitest";
import {
  NOTIF_EVENTS,
  WHATSAPP_TEMPLATES,
  guardSatisfied,
  isStillRelevant,
  optInLink,
  optInText,
  parseInbound,
  pushMessage,
  retryDelaySeconds,
  smsText,
  templateParams,
  toGsm,
  whatsappMode,
  whatsappText,
  type NotificationData,
} from "./index";

const data: NotificationData = {
  code: "C-047",
  place: "DOUALA CLINIC – Akwa",
  ahead: 3,
  waitMinutes: 18,
  counter: "Cabinet 3",
  link: "http://localhost:3000/t/Xk3QpL9vR2mT8wYz4bN7Q",
  lateUntil: "10:30",
};

describe("opt-in WhatsApp", () => {
  it("message prérempli : numéro du ticket et 4 derniers caractères du jeton", () => {
    expect(optInText("C-047", "Xk3QpL9vR2mT8wYz4b7K3Q")).toBe("NEXTIN C-047 7K3Q");
    expect(optInText("C-047", "Xk3QpL9vR2mT8wYz4b7K3Q", "en")).toBe("NEXTIN C-047 7K3Q EN");
    expect(optInLink("+237 6 90 00 00 00", "C-047", "Xk3QpL9vR2mT8wYz4b7K3Q")).toBe(
      "https://wa.me/237690000000?text=NEXTIN%20C-047%207K3Q",
    );
  });
  it("analyse : aller-retour, casse du suffixe conservée, variantes tolérées", () => {
    expect(parseInbound(optInText("C-047", "abcdefgh7k3Q", "en"))).toEqual({ kind: "opt_in", code: "C-047", suffix: "7k3Q", locale: "en" });
    expect(parseInbound("  nextin  c-47 7K3Q ")).toEqual({ kind: "other" });
    expect(parseInbound("nextin c - 047   7K3Q")).toEqual({ kind: "opt_in", code: "C-047", suffix: "7K3Q", locale: "fr" });
    expect(parseInbound("NEXTIN RC-1204 a1B2")).toMatchObject({ kind: "opt_in", code: "RC-1204" });
  });
  it("STOP et START (français et anglais), le reste est ignoré", () => {
    for (const w of ["STOP", "stop", "Arrêt", "ARRET", "Stop."]) expect(parseInbound(w)).toEqual({ kind: "stop" });
    for (const w of ["START", "reprendre"]) expect(parseInbound(w)).toEqual({ kind: "start" });
    expect(parseInbound("Bonjour, je suis en retard")).toEqual({ kind: "other" });
  });
});

describe("modèles WhatsApp (à faire approuver par Meta)", () => {
  it("mêmes variables en FR et EN, numérotées sans trou, ni au début ni à la fin du corps", () => {
    for (const e of NOTIF_EVENTS) {
      const t = WHATSAPP_TEMPLATES[e];
      expect(t.name).toMatch(/^[a-z0-9_]+$/);
      const vars = (b: string) => [...b.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      for (const locale of ["fr", "en"] as const) {
        const body = t.body[locale];
        expect(vars(body)).toEqual(Array.from({ length: t.params(data).length }, (_, i) => i + 1));
        expect(body.trim().startsWith("{{")).toBe(false);
        expect(body.trim().endsWith("}}")).toBe(false);
        expect(body.length).toBeLessThanOrEqual(1024);
        // Modèle d'authentification (code) : texte imposé par Meta, sans mention STOP.
        if (t.category !== "authentication") expect(body).toMatch(/STOP/);
      }
    }
  });
  it("rendu complet, sans variable restante", () => {
    expect(whatsappText("your_turn", "fr", data)).toBe(
      "C'est votre tour ! Ticket C-047 chez DOUALA CLINIC – Akwa.\nPrésentez-vous : Cabinet 3.\nRépondez STOP pour ne plus recevoir ces messages.",
    );
    for (const e of NOTIF_EVENTS) for (const l of ["fr", "en"] as const) expect(whatsappText(e, l, data)).not.toMatch(/\{\{/);
    expect(whatsappText("ticket_confirmed", "en", data)).toContain(data.link);
  });
  it("variables nettoyées (Meta refuse retours à la ligne et valeurs vides)", () => {
    expect(templateParams("your_turn", { ...data, place: "A\nB", counter: null })).toEqual(["C-047", "A B", "-"]);
  });
});

describe("SMS et web push", () => {
  it("SMS en alphabet GSM-7, 160 caractères au plus pour un appel", () => {
    expect(toGsm("Présentez-vous à l’accueil – ≈ 5 min")).toBe("Presentez-vous a l'accueil - ~ 5 min");
    for (const l of ["fr", "en"] as const) {
      const text = smsText("your_turn", l, data);
      expect(text).toMatch(/^[\x20-\x7E]+$/);
      expect(text.length).toBeLessThanOrEqual(160);
    }
  });
  it("M9 : code de vérification et ticket à distance en un seul SMS", () => {
    const d = { ...data, otp: "481516", penaltyPlaces: 3 };
    for (const l of ["fr", "en"] as const) {
      for (const e of ["request_code", "presence_reminder", "time_to_leave"] as const) {
        expect(smsText(e, l, d).length).toBeLessThanOrEqual(160);
      }
      expect(smsText("request_code", l, d)).toContain("481516");
    }
    expect(whatsappText("presence_reminder", "fr", d)).toContain("reculera de 3 places");
  });
  it("push : titre, texte et lien du ticket", () => {
    expect(pushMessage("your_turn", "fr", data)).toEqual({ title: "C'est votre tour !", body: "Ticket C-047 · Cabinet 3", url: data.link, tag: "nextin-C-047" });
  });
});

describe("règles d'envoi", () => {
  const now = new Date("2026-10-28T09:00:00Z");
  it("message libre dans la fenêtre de 24 h, modèle sinon (marge d'une minute)", () => {
    expect(whatsappMode("2026-10-28T12:00:00Z", now)).toBe("session");
    expect(whatsappMode("2026-10-28T09:00:30Z", now)).toBe("template");
    expect(whatsappMode(null, now)).toBe("template");
  });
  it("trois tentatives au plus", () => {
    expect([1, 2, 3].map(retryDelaySeconds)).toEqual([30, 120, null]);
  });
  it("pertinence au moment de l'envoi et délai de garde", () => {
    expect(isStillRelevant("your_turn", "called")).toBe(true);
    expect(isStillRelevant("your_turn", "serving")).toBe(false);
    expect(isStillRelevant("almost_your_turn", "waiting")).toBe(true);
    expect(isStillRelevant("almost_your_turn", "called")).toBe(false);
    // M9 : ticket à distance et demandes de rendez-vous.
    expect(isStillRelevant("time_to_leave", "waiting")).toBe(true);
    expect(isStillRelevant("presence_reminder", "called")).toBe(false);
    expect(isStillRelevant("remote_cancelled", "cancelled")).toBe(true);
    expect(isStillRelevant("request_code", "unverified")).toBe(true);
    expect(isStillRelevant("request_code", "pending")).toBe(false);
    expect(isStillRelevant("request_accepted", "confirmed")).toBe(true);
    expect(isStillRelevant("request_declined", "declined")).toBe(true);
    expect(guardSatisfied("delivered")).toBe(true);
    expect(guardSatisfied("sent")).toBe(false);
  });
});
