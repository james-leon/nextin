/**
 * Agences consultées depuis cet appareil (P3, section « Récents » de « À proximité ») : informations publiques
 * seulement (nom de l'établissement et de l'agence, secteur, ville), jamais de position ni de donnée personnelle.
 * Enregistrées à l'ouverture d'une page d'agence (`/b/<id>`), 6 au plus, effaçables par le client.
 */
export type RecentBranch = { id: string; organization: string; name: string; type: string; city: string | null; visitedAt: number };

const KEY = "nextin-recent-branches";
const MAX = 6;
const EVENT = "nextin-recent-branches";
const EMPTY: RecentBranch[] = [];
let cache: { raw: string | null; list: RecentBranch[] } = { raw: null, list: EMPTY };

function read(): RecentBranch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.list;
    const parsed = raw ? (JSON.parse(raw) as RecentBranch[]) : [];
    const list = Array.isArray(parsed) ? parsed.filter((b) => typeof b?.id === "string" && typeof b?.organization === "string").slice(0, MAX) : [];
    cache = { raw, list };
    return list;
  } catch {
    return EMPTY;
  }
}

function write(list: RecentBranch[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Stockage indisponible (navigation privée) : pas de section « Récents ».
  }
}

export function rememberBranch(branch: Omit<RecentBranch, "visitedAt">) {
  write([{ ...branch, visitedAt: Date.now() }, ...read().filter((b) => b.id !== branch.id)].slice(0, MAX));
}

export function clearRecentBranches() {
  write([]);
}

/** Pour `useSyncExternalStore` : liste stable tant que le stockage ne change pas ; vide côté serveur. */
export const recentBranchesStore = {
  subscribe(callback: () => void) {
    window.addEventListener(EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(EVENT, callback);
      window.removeEventListener("storage", callback);
    };
  },
  getSnapshot: read,
  getServerSnapshot: () => EMPTY,
};
