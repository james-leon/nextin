/**
 * Montant d'une facture en toutes lettres (maquette v2 15 : « Arrêtée à la somme de soixante et un mille quatre cent
 * dix francs CFA. »). Francs CFA entiers, de 0 à 999 999 999 999. Orthographe traditionnelle (traits d'union sous
 * cent, « et » devant un et onze, « quatre-vingts » et « cents » au pluriel seulement en fin de nombre, « mille »
 * invariable, « millions » et « milliards » au pluriel, suivis de « de » quand rien ne suit).
 */

const FR_UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const FR_TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 à 99 ; `final` : dernier mot du nombre (« quatre-vingts » prend alors un s). */
function frBelow100(n: number, final: boolean): string {
  if (n < 20) return FR_UNITS[n]!;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens === 7 || tens === 9) {
    // 70-79 : soixante-dix… (soixante et onze) ; 90-99 : quatre-vingt-dix…
    if (tens === 7 && unit === 1) return "soixante et onze";
    return `${tens === 7 ? "soixante" : "quatre-vingt"}-${FR_UNITS[10 + unit]}`;
  }
  if (tens === 8) return unit === 0 ? (final ? "quatre-vingts" : "quatre-vingt") : `quatre-vingt-${FR_UNITS[unit]}`;
  if (unit === 0) return FR_TENS[tens]!;
  if (unit === 1) return `${FR_TENS[tens]} et un`;
  return `${FR_TENS[tens]}-${FR_UNITS[unit]}`;
}

/** 1 à 999 ; `final` : le groupe termine le nombre (accord de « cents » et « quatre-vingts »). */
function frBelow1000(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    const plural = hundreds > 1 && rest === 0 && final;
    parts.push(hundreds === 1 ? "cent" : `${FR_UNITS[hundreds]} ${plural ? "cents" : "cent"}`);
  }
  if (rest > 0) parts.push(frBelow100(rest, final));
  return parts.join(" ");
}

export function frenchNumber(value: number): string {
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return "zéro";
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  const parts: string[] = [];
  if (billions) parts.push(`${frBelow1000(billions, true)} ${billions > 1 ? "milliards" : "milliard"}`);
  if (millions) parts.push(`${frBelow1000(millions, true)} ${millions > 1 ? "millions" : "million"}`);
  // « mille » invariable, jamais « un mille » ; le groupe devant n'est pas final (« deux cent mille », « quatre-vingt mille »).
  if (thousands) parts.push(thousands === 1 ? "mille" : `${frBelow1000(thousands, false)} mille`);
  if (rest) parts.push(frBelow1000(rest, true));
  return (value < 0 ? "moins " : "") + parts.join(" ");
}

const EN_UNITS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const restText = rest < 20 ? EN_UNITS[rest]! : EN_TENS[Math.floor(rest / 10)]! + (rest % 10 ? `-${EN_UNITS[rest % 10]}` : "");
  if (!hundreds) return restText;
  return `${EN_UNITS[hundreds]} hundred${rest ? ` and ${restText}` : ""}`;
}

export function englishNumber(value: number): string {
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return "zero";
  const groups: [number, string][] = [
    [Math.floor(n / 1e9), "billion"],
    [Math.floor((n % 1e9) / 1e6), "million"],
    [Math.floor((n % 1e6) / 1e3), "thousand"],
    [n % 1e3, ""],
  ];
  const parts = groups.filter(([v]) => v > 0).map(([v, word]) => (word ? `${enBelow1000(v)} ${word}` : enBelow1000(v)));
  // « one thousand and five » : « and » devant un dernier groupe sans centaines.
  const last = n % 1e3;
  if (n >= 1000 && last > 0 && last < 100) parts[parts.length - 1] = `and ${parts[parts.length - 1]}`;
  return (value < 0 ? "minus " : "") + parts.join(" ");
}

/**
 * Montant en lettres avec la devise : « soixante et un mille quatre cent dix francs CFA », « un franc CFA »,
 * « un million de francs CFA » ; en anglais « sixty-one thousand four hundred and ten CFA francs ».
 */
export function amountInWords(xaf: number, locale: "fr" | "en"): string {
  const n = Math.trunc(Math.abs(xaf));
  if (locale === "en") return `${englishNumber(xaf)} ${n === 1 ? "CFA franc" : "CFA francs"}`;
  // « de » après « million(s) » ou « milliard(s) » quand le nombre s'arrête là.
  const of = n >= 1e6 && n % 1e6 === 0 ? "de " : "";
  return `${frenchNumber(xaf)} ${of}${n <= 1 ? "franc CFA" : "francs CFA"}`;
}
