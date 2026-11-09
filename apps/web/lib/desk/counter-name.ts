/** Nom affiché d'un poste : libellé personnalisé, sinon « Cabinet 3 », « Guichet 2 »… */
export function counterName(c: { kind: string; number: number; label: string | null }, kindLabel: (kind: string) => string): string {
  return c.label ?? `${kindLabel(c.kind)} ${c.number}`;
}

/** « Dr Mbarga » à partir du titre et du nom du praticien. */
export function practitionerName(p: { title: string | null; display_name: string }): string {
  return [p.title, p.display_name].filter(Boolean).join(" ");
}
