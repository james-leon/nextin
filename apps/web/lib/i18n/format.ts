/**
 * Mise en forme minimale des messages ICU utilisés sur les pages client : variables `{nom}` et
 * pluriels `{n, plural, =0 {…} one {# …} other {# …}}`. Évite d'embarquer intl-messageformat
 * dans le JavaScript des pages client (budget < 200 Ko).
 */
export type MessageValues = Record<string, string | number>;

function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

function plural(body: string, value: number, locale: string): string {
  const options = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf("{", i);
    if (open < 0) break;
    const end = closing(body, open);
    if (end < 0) break;
    options.set(body.slice(i, open).trim(), body.slice(open + 1, end));
    i = end + 1;
  }
  const chosen = options.get(`=${value}`) ?? options.get(new Intl.PluralRules(locale).select(value)) ?? options.get("other") ?? "";
  return chosen.replace(/#/g, new Intl.NumberFormat(locale).format(value));
}

export function formatMessage(message: string, values: MessageValues = {}, locale = "fr"): string {
  let out = "";
  let i = 0;
  while (i < message.length) {
    const open = message.indexOf("{", i);
    if (open < 0) {
      out += message.slice(i);
      break;
    }
    out += message.slice(i, open);
    const end = closing(message, open);
    if (end < 0) {
      out += message.slice(open);
      break;
    }
    const inner = message.slice(open + 1, end);
    const m = inner.match(/^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/);
    if (m) out += plural(m[2]!, Number(values[m[1]!] ?? 0), locale);
    else out += String(values[inner.trim()] ?? `{${inner}}`);
    i = end + 1;
  }
  return out;
}
