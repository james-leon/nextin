/**
 * Initiales d'un nom pour un avatar (« Douala Clinic » → « DC », « Dr Joseph Ekwalla » → « JE ») : titre de
 * civilité ignoré, première et dernière lettre initiale ; un seul mot → ses deux premières lettres.
 */
export function initialsOf(name: string): string {
  const words = name.replace(/^(dr|pr|m|mme)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}
