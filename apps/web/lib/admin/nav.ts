/**
 * Rubriques présentes dans les barres latérales (établissement, espace annonceur, console Wintek, et le lien
 * « Mes établissements ») : sur ordinateur, un bouton retour vers l'une d'elles ferait doublon avec la barre.
 */
const SIDEBAR_DESTINATIONS = [
  /^\/app$/,
  /^\/app\/o\/[^/]+(\/(branches|practitioners|staff|ads|billing))?$/,
  /^\/ads(\/redeem)?$/,
  /^\/admin(\/(plans|ads|settings))?$/,
];

export function isSidebarDestination(href: string): boolean {
  const path = href.split(/[?#]/)[0]!;
  return SIDEBAR_DESTINATIONS.some((re) => re.test(path));
}
