/**
 * Refus liés à l'abonnement, au quota du mois ou à la formule : jamais détaillés au visiteur. La page client affiche
 * le message neutre « momentanément indisponible » (les détails restent réservés au personnel).
 */
const CODES = new Set(["subscription_read_only", "monthly_quota_reached", "quota_reached", "feature_unavailable", "plan_limit"]);

export function isOnlineUnavailable(code: string | null | undefined): boolean {
  return !!code && CODES.has(code);
}
