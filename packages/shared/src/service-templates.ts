import { SERVICE_COLORS, type ServiceColor } from "./ticket";

/**
 * Modèles de services par secteur (P1 : création d'un établissement depuis la console Wintek). Point de départ
 * modifiable ensuite par le directeur : nom FR/EN, préfixe du ticket, durée moyenne, couleur de la palette.
 * Préfixes uniques dans chaque modèle (vérifié par Vitest et par la base).
 */
export type ServiceTemplate = {
  key: string;
  name: { fr: string; en: string };
  prefix: string;
  minutes: number;
  color: ServiceColor;
};

export type ServiceTemplateOrgType = "clinic" | "hospital" | "telecom" | "bank" | "utility" | "administration" | "other";

const t = (key: string, fr: string, en: string, prefix: string, minutes: number, color: ServiceColor): ServiceTemplate => ({
  key,
  name: { fr, en },
  prefix,
  minutes,
  color,
});

export const SERVICE_TEMPLATES: Record<ServiceTemplateOrgType, readonly ServiceTemplate[]> = {
  clinic: [
    t("consultation", "Consultation", "Consultation", "C", 15, "blue"),
    t("laboratory", "Laboratoire", "Laboratory", "L", 10, "green"),
    t("pharmacy", "Pharmacie", "Pharmacy", "P", 5, "purple"),
    t("cashier", "Caisse", "Cashier", "A", 5, "ochre"),
  ],
  hospital: [
    t("emergency", "Urgences", "Emergency", "U", 20, "rose"),
    t("consultation", "Consultation", "Consultation", "C", 15, "blue"),
    t("laboratory", "Laboratoire", "Laboratory", "L", 10, "green"),
    t("imaging", "Imagerie", "Imaging", "I", 20, "teal"),
    t("pharmacy", "Pharmacie", "Pharmacy", "P", 5, "purple"),
    t("cashier", "Caisse", "Cashier", "A", 5, "ochre"),
  ],
  telecom: [
    t("subscription", "Abonnement", "New line", "A", 10, "blue"),
    t("claim", "Réclamation", "Complaint", "R", 10, "rose"),
    t("bundles", "Forfaits et recharges", "Bundles and top-ups", "F", 5, "green"),
    t("mobile_money", "Mobile Money", "Mobile Money", "M", 5, "ochre"),
  ],
  bank: [
    t("cash", "Dépôt et retrait", "Deposit and withdrawal", "D", 5, "blue"),
    t("account", "Ouverture de compte", "Account opening", "O", 20, "green"),
    t("advisor", "Conseiller", "Advisor", "C", 15, "navy"),
    t("transfers", "Transferts", "Transfers", "T", 5, "teal"),
  ],
  utility: [
    t("bill", "Paiement de facture", "Bill payment", "P", 5, "blue"),
    t("claim", "Réclamation", "Complaint", "R", 10, "rose"),
    t("subscription", "Nouvel abonnement", "New subscription", "A", 15, "green"),
    t("connection", "Branchement", "Connection", "B", 15, "ochre"),
  ],
  administration: [
    t("filing", "Dépôt de dossier", "File submission", "D", 10, "blue"),
    t("collection", "Retrait de document", "Document collection", "R", 5, "green"),
    t("information", "Renseignements", "Information", "I", 5, "slate"),
    t("certification", "Légalisation", "Certification", "L", 5, "purple"),
  ],
  other: [
    t("reception", "Accueil", "Reception", "A", 5, "blue"),
    t("customer_service", "Service client", "Customer service", "S", 10, "green"),
  ],
};

/** Services choisis d'un modèle, prêts pour `admin_create_organization` (clés inconnues ignorées, ordre du modèle). */
export function templateServices(type: ServiceTemplateOrgType, keys: readonly string[]) {
  const wanted = new Set(keys);
  return SERVICE_TEMPLATES[type]
    .filter((s) => wanted.has(s.key))
    .map((s) => ({ name: s.name.fr, name_en: s.name.en, prefix: s.prefix, seconds: s.minutes * 60, color: SERVICE_COLORS[s.color] }));
}
