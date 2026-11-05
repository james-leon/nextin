import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, isLegalDraft, legalPlaceholders, parseInline, parseLegalBody } from "./documents";

const source = (name: string) => readFileSync(join(__dirname, "../../../../docs", name), "utf8");

describe("textes légaux", () => {
  it("français intégré tel quel : un article par section numérotée du projet", () => {
    for (const [key, file] of [
      ["terms", "NEXTIN_CGU.md"],
      ["privacy", "NEXTIN_CONFIDENTIALITE.md"],
    ] as const) {
      const md = source(file);
      const titles = [...md.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1]!.trim());
      const doc = LEGAL_DOCUMENTS[key].fr;
      expect(doc.sections.map((s) => s.title)).toEqual(titles);
      for (const s of doc.sections) expect(md).toContain(s.body.split("\n")[0]!);
      expect(md).toContain(doc.version);
    }
  });

  it("anglais : mêmes articles, traduction signalée", () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      expect(doc.en.sections).toHaveLength(doc.fr.sections.length);
      expect(doc.en.translationNote).toBe("Translation for information; the French version prevails.");
      expect(doc.fr.translationNote).toBeUndefined();
      expect(isLegalDraft(doc.fr)).toBe(false);
    }
  });

  it("mentions à compléter gardées visibles", () => {
    expect(legalPlaceholders(LEGAL_DOCUMENTS.terms.fr)).toEqual(expect.arrayContaining(["[DATE DE MISE EN LIGNE]", "[À COMPLÉTER]"]));
    expect(parseInline("NIU [À COMPLÉTER], **gras**")).toEqual([
      { text: "NIU " },
      { text: "[À COMPLÉTER]", placeholder: true },
      { text: ", " },
      { text: "gras", bold: true },
    ]);
  });

  it("corps : paragraphes, listes, sous-titres, tableaux", () => {
    const blocks = parseLegalBody(LEGAL_DOCUMENTS.privacy.fr.sections[2]!.body);
    expect(blocks[0]).toEqual({ kind: "h3", text: "Visiteurs" });
    const table = blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" ? table.rows.length : 0).toBe(7);
    expect(blocks.some((b) => b.kind === "list")).toBe(true);
  });
});
