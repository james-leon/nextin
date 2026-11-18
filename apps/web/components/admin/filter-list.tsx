"use client";

import { Children, useState, type ReactNode } from "react";
import { SearchField } from "@/components/ui/text-field";

/**
 * Recherche dans une liste du back-office (maquette v2 17, « Rechercher ») : les lignes, rendues par le serveur, sont
 * filtrées sur leur texte (`texts`, même ordre que `children`), sans accents ni majuscules.
 */
export function FilterList({ label, clearLabel, texts, children, empty }: { label: string; clearLabel: string; texts: string[]; children: ReactNode; empty: ReactNode }) {
  const [query, setQuery] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = norm(query.trim());
  const rows = Children.toArray(children);
  const visible = rows.filter((_, i) => !q || norm(texts[i] ?? "").includes(q));
  return (
    <>
      <SearchField label={label} clearLabel={clearLabel} value={query} onValueChange={setQuery} />
      {visible.length ? visible : empty}
    </>
  );
}
