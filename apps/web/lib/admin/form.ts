/** FormData → objet simple (les champs répétés deviennent des tableaux). */
export function formObject(data: FormData, arrays: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(data.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = data.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrays.includes(key) ? values : values[0];
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}
