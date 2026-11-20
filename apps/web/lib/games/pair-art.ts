import type { PairFace } from "@nextin/shared/games/pairs";

/**
 * Dessins des cartes du jeu de paires (maquette v2 11) : fruits et produits du marché, vectoriels (viewBox 24 × 24),
 * lisibles en petit, sans fichier à charger. Ce sont des illustrations (comme le logo) : leurs couleurs sont fixes et
 * identiques en clair et en sombre (la face de la carte reste blanche).
 */
export const PAIR_ART: Record<PairFace, { disc: string; svg: string }> = {
  mango: {
    disc: "#FEF1E3",
    svg: '<path d="M12 4c5 0 8 4 8 9s-4 8-8 8-8-3-8-7 3-10 8-10z" fill="#F7A23B"/><path d="M8 6c2-1 5-1 7 1-3 0-5 1-6 3" fill="#E35F2B" opacity=".55"/><path d="M12 4c0-1.5 1-2.5 2.5-3" stroke="#5B3A1E" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M14 2c2 0 4 1 4.5 2.5-2 .5-3.6 0-4.5-2.5z" fill="#3E9B4F"/>',
  },
  pineapple: {
    disc: "#FFF7DC",
    svg: '<ellipse cx="12" cy="15" rx="5.5" ry="7" fill="#F2B632"/><path d="M8 11l8 8M16 11l-8 8M7.5 15l9 0" stroke="#C98516" stroke-width="1" opacity=".7"/><path d="M12 8L9 2l3 3 3-3z" fill="#3E9B4F"/><path d="M12 8L7 4l5 2 5-2z" fill="#2E7D3E"/>',
  },
  plantain: {
    disc: "#F3F8E3",
    svg: '<path d="M5 6c2 8 7 13 15 13-1 2-4 3-7 2-5-2-9-8-8-15z" fill="#B7C93A"/><path d="M5 6c2 8 7 13 15 13" stroke="#7E8F1E" stroke-width="1.2" fill="none"/><path d="M4 4.5l1.5 2" stroke="#5B3A1E" stroke-width="1.6" stroke-linecap="round"/>',
  },
  avocado: {
    disc: "#E7F6EE",
    svg: '<path d="M12 3c3 0 4 3 5 6 2 5 1 12-5 12S5 14 7 9c1-3 2-6 5-6z" fill="#3E7D32"/><path d="M12 6c2 0 3 2 3.5 4 1.5 3.5.5 8.5-3.5 8.5S7 13.5 8.5 10C9 8 10 6 12 6z" fill="#C9DE7B"/><circle cx="12" cy="14" r="2.8" fill="#8A5A2B"/>',
  },
  coconut: {
    disc: "#F4EDE6",
    svg: '<circle cx="12" cy="13" r="8" fill="#7A4E2B"/><path d="M5 12a7 7 0 0 1 14 0z" fill="#FFFFFF"/><path d="M5 12a7 7 0 0 1 14 0" stroke="#5A3820" stroke-width="1.2" fill="none"/><circle cx="10" cy="16" r="1" fill="#4A2D18"/><circle cx="14" cy="16" r="1" fill="#4A2D18"/><circle cx="12" cy="18.3" r="1" fill="#4A2D18"/>',
  },
  orange: {
    disc: "#FEF1E3",
    svg: '<circle cx="12" cy="13" r="8" fill="#F58B1F"/><circle cx="9.5" cy="10.5" r="1.6" fill="#FFB467" opacity=".8"/><path d="M12 5c0-1.5.5-2.5 2-3" stroke="#5B3A1E" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M13 4c2-1.5 4-1 5 0-2 1-3.5 1-5 0z" fill="#3E9B4F"/>',
  },
  papaya: {
    disc: "#FFF0E6",
    svg: '<path d="M12 3c4 0 6 4 6 9s-2 9-6 9-6-4-6-9 2-9 6-9z" fill="#F5A04C"/><path d="M12 6c2.5 0 3.8 3 3.8 6.5S14.5 19 12 19s-3.8-3-3.8-6.5S9.5 6 12 6z" fill="#F06A3A"/><g fill="#2A1A12"><circle cx="11" cy="11" r=".9"/><circle cx="13" cy="12" r=".9"/><circle cx="11.5" cy="14" r=".9"/><circle cx="13" cy="15.5" r=".9"/><circle cx="11" cy="16.5" r=".9"/></g>',
  },
  corn: {
    disc: "#FFF7DC",
    svg: '<ellipse cx="12" cy="11" rx="4" ry="8" fill="#F5C842"/><g fill="#E0A81C"><circle cx="10.5" cy="7" r=".9"/><circle cx="13.5" cy="7" r=".9"/><circle cx="12" cy="9" r=".9"/><circle cx="10.5" cy="11" r=".9"/><circle cx="13.5" cy="11" r=".9"/><circle cx="12" cy="13" r=".9"/><circle cx="10.5" cy="15" r=".9"/><circle cx="13.5" cy="15" r=".9"/></g><path d="M8 12c0 5 1 8 4 10-5 0-7-4-6-9zM16 12c0 5-1 8-4 10 5 0 7-4 6-9z" fill="#4E9A3A"/>',
  },
  pepper: {
    disc: "#FDECEC",
    svg: '<path d="M7 9c3-1 6 0 8 3 2 3 3 7 2 9-1-3-3-5-6-7-3-1-5-3-4-5z" fill="#D93B3B"/><path d="M8.5 10c2 0 4 .5 5.5 2" stroke="#FF8A8A" stroke-width="1" fill="none" opacity=".7"/><path d="M7 9C6 7 6 5 7.5 4" stroke="#3E7D32" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  },
  peanut: {
    disc: "#F7EFE3",
    svg: '<path d="M9 5c3-1 5 1 5 3 0 1.5-1 2.3-1 3.5S15 14 15 16c0 3-3 5-6 4s-4-4-3-6c.7-1.4 1.6-2 1.6-3.2S6 9 6 8c0-1.5 1-2.6 3-3z" fill="#D9A35F"/><g stroke="#B07A3A" stroke-width=".8" opacity=".8"><path d="M8 7l3 2M7 14l4 2M8 17l3 1"/></g>',
  },
};
