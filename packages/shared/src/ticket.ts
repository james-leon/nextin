/**
 * Format d'affichage d'un ticket (maquette) : préfixe du service, tiret, numéro sur 3 chiffres.
 * Ex. ("C", 47) → "C-047" ; au-delà de 999 le numéro n'est pas tronqué ("C-1204").
 */
export function formatTicketCode(prefix: string, number: number): string {
  if (!/^[A-Z]{1,2}$/.test(prefix)) throw new RangeError("Ticket prefix must be 1-2 uppercase letters");
  if (!Number.isInteger(number) || number < 1) throw new RangeError("Ticket number must be a positive integer");
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

/** Version épelée pour les lecteurs d'écran : "C-047" → "C 0 4 7". */
export function spellTicketCode(code: string): string {
  return code.replace(/-/g, "").split("").join(" ");
}

/** Palette des pastilles de service (maquette « Choisir un service ») — texte blanc AA sur chaque teinte. */
export const SERVICE_COLORS = {
  blue: "#1A6BB5",
  green: "#2E8B57",
  purple: "#8E5BB5",
  ochre: "#B5651A",
  navy: "#0D2C54",
  teal: "#13798A",
  rose: "#B5446E",
  slate: "#56606F",
} as const;
export type ServiceColor = keyof typeof SERVICE_COLORS;

/** Origine d'un ticket (enum SQL `ticket_source`). */
export const TICKET_SOURCES = ["qr", "short_code", "remote", "reception"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

/**
 * « Je suis en route » n'a de sens que pour un ticket pris à distance (M9) :
 * jamais pour un ticket pris sur place (QR, code court) ni créé à l'accueil.
 */
export function canSignalOnMyWay(source: TicketSource): boolean {
  return source === "remote";
}
