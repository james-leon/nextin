/**
 * Canaux Realtime Broadcast alimentés par les déclencheurs SQL (migration M3).
 * - tableau public d'une agence (écran TV, page client) : codes et postes uniquement ;
 * - ticket d'un client : topic dont le nom contient le jeton secret du lien /t/<jeton> ;
 * - canal privé du personnel de l'agence (politique RLS sur realtime.messages).
 */
export const REALTIME_EVENTS = { board: "board", ticket: "ticket" } as const;

export const boardTopic = (branchId: string) => `branch:${branchId}:board`;
export const ticketTopic = (publicToken: string) => `ticket:${publicToken}`;
export const staffTopic = (branchId: string) => `staff:branch:${branchId}`;
