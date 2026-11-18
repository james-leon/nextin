"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SearchField } from "@/components/ui/text-field";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Recherche dans une liste groupée du back-office (maquettes v2 17 et 18, « Rechercher ») : la liste, rendue par le
 * serveur, reste une seule liste ; les lignes (`ul > li`, dans l'ordre de `texts`) qui ne correspondent pas sont
 * masquées, sans accents ni majuscules. Aucune ligne : `empty` à la place.
 */
export function FilterList({ label, clearLabel, texts, children, empty }: { label: string; clearLabel: string; texts: string[]; children: ReactNode; empty: ReactNode }) {
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const q = norm(query.trim());
  const matches = texts.map((text) => !q || norm(text).includes(q));
  const count = matches.filter(Boolean).length;
  useEffect(() => {
    const rows = box.current?.querySelectorAll<HTMLLIElement>("ul > li") ?? [];
    rows.forEach((row, i) => {
      row.hidden = matches[i] === false;
    });
  });
  return (
    <>
      <SearchField label={label} clearLabel={clearLabel} value={query} onValueChange={setQuery} />
      <div ref={box} hidden={count === 0} className="contents">
        {children}
      </div>
      {count === 0 ? empty : null}
    </>
  );
}
