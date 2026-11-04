import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, isLegalDraft } from "./documents";

describe("textes légaux", () => {
  it("le français et l'anglais ont les mêmes articles, dans le même ordre", () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      expect(doc.en.sections.length).toBe(doc.fr.sections.length);
      expect(doc.en.sections.map((s) => s.paragraphs.length)).toEqual(doc.fr.sections.map((s) => s.paragraphs.length));
    }
  });

  it("un document sans contenu est un brouillon (« Bientôt disponible »)", () => {
    expect(isLegalDraft(LEGAL_DOCUMENTS.terms.fr)).toBe(true);
    expect(isLegalDraft({ title: "x", updatedAt: "2026-11-04", sections: [{ title: "Objet", paragraphs: ["Texte."] }] })).toBe(false);
  });
});
