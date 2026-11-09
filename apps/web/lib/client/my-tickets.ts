/**
 * Tickets suivis depuis cet appareil (onglet « Mon ticket ») : jeton du lien, code et code d'entrée
 * de l'agence (retour au choix du service). Aucune donnée personnelle.
 */
export type SavedTicket = {
  token: string;
  code: string;
  entry: string | null;
  savedAt: number;
  /** Ticket à distance (M9) : agence, pour confirmer la présence en scannant son QR code. */
  branchId?: string;
  remote?: boolean;
};

const KEY = "nextin-tickets";
const MAX = 10;

export function listSavedTickets(): SavedTicket[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedTicket[]) : [];
    return Array.isArray(list) ? list.filter((t) => typeof t?.token === "string") : [];
  } catch {
    return [];
  }
}

export function saveTicket(ticket: Omit<SavedTicket, "savedAt">) {
  const previous = savedTicket(ticket.token);
  const merged = { ...previous, ...ticket, entry: ticket.entry ?? previous?.entry ?? null, savedAt: Date.now() };
  const list = [merged, ...listSavedTickets().filter((t) => t.token !== ticket.token)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Stockage indisponible : le lien du ticket reste valable.
  }
}

export function forgetTicket(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listSavedTickets().filter((t) => t.token !== token)));
  } catch {
    // Rien à faire.
  }
}

export function savedTicket(token: string): SavedTicket | null {
  return listSavedTickets().find((t) => t.token === token) ?? null;
}

/** Tickets à distance de cet appareil dans une agence (confirmation de présence au scan de son QR code). */
export function remoteTicketsFor(branchId: string): SavedTicket[] {
  return listSavedTickets().filter((t) => t.remote && t.branchId === branchId);
}
