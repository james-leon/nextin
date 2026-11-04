/*
 * Textes légaux de NextIn (Wintek). Structure en articles numérotés, prête à recevoir le contenu fourni par
 * Wintek : remplir `paragraphs` (un paragraphe par entrée) et `updatedAt` (AAAA-MM-JJ). Tant qu'un article
 * est vide, la page affiche « Bientôt disponible » et « Contenu à venir » sous son titre.
 * Les intitulés des articles sont une proposition, à ajuster avec les textes définitifs.
 */

export type LegalLocale = "fr" | "en";
export type LegalDocKey = "terms" | "privacy";

export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDocument = { title: string; updatedAt: string | null; sections: LegalSection[] };

const empty = (titles: string[]): LegalSection[] => titles.map((title) => ({ title, paragraphs: [] }));

export const LEGAL_DOCUMENTS: Record<LegalDocKey, Record<LegalLocale, LegalDocument>> = {
  terms: {
    fr: {
      title: "Conditions générales d'utilisation",
      updatedAt: null,
      sections: empty([
        "Objet",
        "Définitions",
        "Accès au service",
        "Comptes du personnel et sécurité",
        "Utilisation par les clients (tickets, rendez-vous)",
        "Obligations des établissements",
        "Abonnements, essai et paiement",
        "Publicité",
        "Données personnelles",
        "Disponibilité et responsabilité",
        "Propriété intellectuelle",
        "Modification des conditions",
        "Droit applicable et litiges",
        "Contact",
      ]),
    },
    en: {
      title: "Terms of use",
      updatedAt: null,
      sections: empty([
        "Purpose",
        "Definitions",
        "Access to the service",
        "Staff accounts and security",
        "Use by customers (tickets, appointments)",
        "Obligations of organizations",
        "Subscriptions, trial and payment",
        "Advertising",
        "Personal data",
        "Availability and liability",
        "Intellectual property",
        "Changes to these terms",
        "Governing law and disputes",
        "Contact",
      ]),
    },
  },
  privacy: {
    fr: {
      title: "Politique de confidentialité",
      updatedAt: null,
      sections: empty([
        "Responsable du traitement",
        "Données collectées",
        "Finalités",
        "Bases légales",
        "Destinataires",
        "Durées de conservation",
        "Sécurité",
        "Transferts hors du Cameroun",
        "Vos droits",
        "Cookies et stockage sur l'appareil",
        "Mineurs",
        "Modifications de la politique",
        "Contact et réclamations",
      ]),
    },
    en: {
      title: "Privacy policy",
      updatedAt: null,
      sections: empty([
        "Data controller",
        "Data we collect",
        "Purposes",
        "Legal bases",
        "Recipients",
        "Retention periods",
        "Security",
        "Transfers outside Cameroon",
        "Your rights",
        "Cookies and on-device storage",
        "Minors",
        "Changes to this policy",
        "Contact and complaints",
      ]),
    },
  },
};

/** Vrai tant qu'au moins un article attend son contenu. */
export function isLegalDraft(doc: LegalDocument): boolean {
  return doc.sections.some((s) => s.paragraphs.length === 0);
}
