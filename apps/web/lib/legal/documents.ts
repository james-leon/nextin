/*
 * Textes légaux de NextIn (Wintek) : CGU et politique de confidentialité.
 * Français = source (docs/NEXTIN_CGU.md, docs/NEXTIN_CONFIDENTIALITE.md, projets à faire relire par un juriste),
 * intégrés tels quels : un article par section numérotée, corps en Markdown simplifié (paragraphes, listes « - »,
 * sous-titres « ### », tableaux, **gras**) rendu par `parseLegalBody`. Les mentions entre crochets ([À COMPLÉTER]…)
 * restent visibles (surlignées) jusqu'à ce que Wintek les remplisse. Anglais : traduction pour information, la version
 * française fait foi. Pour mettre à jour : modifier le fichier Markdown, puis recopier ici (mêmes articles, même ordre).
 */

export type LegalLocale = "fr" | "en";
export type LegalDocKey = "terms" | "privacy";

export type LegalSection = { title: string; body: string };
export type LegalDocument = {
  title: string;
  /** Version et date d'entrée en vigueur, affichées en haut de la page. */
  version: string;
  /** Avertissement du projet (relecture juridique), affiché sous la version tant qu'il existe. */
  notice: string | null;
  /** Traduction : la version française fait foi. */
  translationNote?: string;
  sections: LegalSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocKey, Record<LegalLocale, LegalDocument>> = {
  terms: {
    fr: {
    title: "Conditions générales d'utilisation",
    version: "Version 1.0 — en vigueur le [DATE DE MISE EN LIGNE]",
    notice: "Projet à faire relire par un juriste avant publication.",
    sections: [
      {
        title: "Éditeur",
        body: "NextIn est un service édité par WINTEK (Winner Teknology), entreprise immatriculée au registre du commerce de Douala sous le numéro RC/DLA/2021/A/1608, NIU [À COMPLÉTER], dont le siège est situé à Rond-point Poulenc, Makepe (face EEC), Douala, Cameroun.\nContact : contact@wintekservices.com — +237 690 72 23 16.",
      },
      {
        title: "Objet",
        body: "Les présentes conditions encadrent l'utilisation de NextIn, plateforme de gestion des files d'attente et des espaces d'accueil, accessible sur le web et sur téléphone.\nElles s'appliquent :\n- aux **établissements** qui souscrivent à NextIn (cliniques, banques, administrations, entreprises…) et à leur personnel ;\n- aux **visiteurs** qui prennent un ticket ou un rendez-vous auprès d'un établissement ;\n- aux **annonceurs** qui diffusent des publicités par NextIn Ads.\n\nUtiliser NextIn vaut acceptation des présentes conditions.",
      },
      {
        title: "Définitions",
        body: "- **Établissement** : organisation cliente de NextIn, responsable de l'accueil de ses visiteurs.\n- **Visiteur** : personne qui prend un ticket, demande un rendez-vous ou consulte l'attente.\n- **Personnel** : employés de l'établissement disposant d'un compte (administrateur, responsable, accueil, agent, praticien, caissier).\n- **Annonceur** : professionnel qui diffuse des publicités sur les écrans et dans l'application.\n- **Formule** : offre d'abonnement souscrite par l'établissement (Starter, Business, Premium ou Enterprise).",
      },
      {
        title: "Accès au service",
        body: "4.1. Les visiteurs utilisent NextIn **gratuitement et sans créer de compte**. Le ticket est lié à l'appareil utilisé.\n4.2. Un visiteur peut toujours obtenir un ticket auprès de l'accueil de l'établissement, sans téléphone.\n4.3. Le personnel accède à NextIn avec un compte personnel. Chaque utilisateur garde ses identifiants confidentiels et signale sans délai toute utilisation non autorisée.\n4.4. L'établissement est responsable des comptes qu'il crée, des droits qu'il attribue et des actions réalisées par son personnel.",
      },
      {
        title: "Description du service",
        body: "NextIn permet notamment : la prise de ticket par QR code, à l'accueil ou à distance ; l'appel des visiteurs aux guichets ; l'affichage et l'annonce vocale sur écran ; les alertes par WhatsApp, SMS ou notification ; la gestion des rendez-vous ; les statistiques ; la publicité sur les écrans et dans l'application.\nLes fonctions disponibles dépendent de la formule souscrite. Wintek peut faire évoluer le service ; une fonction essentielle d'une formule payée ne sera pas retirée en cours de période sans information préalable.",
      },
      {
        title: "Formules, prix et paiement",
        body: "6.1. Les prix sont indiqués en francs CFA (FCFA), hors taxes, sur la page Abonnement. Ils peuvent évoluer ; tout changement s'applique à la période suivante, après information de l'établissement.\n6.2. Le paiement se fait par Mobile Money (MTN Mobile Money, Orange Money) ou par tout autre moyen proposé. L'abonnement est mensuel ou annuel, sans engagement au-delà de la période payée.\n6.3. Chaque formule comprend des limites (agences, services, guichets, écrans, utilisateurs, tickets et messages WhatsApp par mois, durée d'historique). Des extensions peuvent être achetées.\n6.4. **Quand une limite mensuelle est atteinte, la file en cours n'est jamais interrompue** : le service continue jusqu'à la fermeture du jour. La prise de nouveaux tickets peut être suspendue à partir du lendemain, jusqu'au changement de formule, à l'achat d'une extension ou au mois suivant.\n6.5. La formule Enterprise fait l'objet d'un devis et d'un contrat particulier.\n6.6. Les sommes versées pour une période commencée ne sont pas remboursées, sauf disposition contraire du contrat ou de la loi. Les frais d'installation et le matériel éventuel sont facturés à part.",
      },
      {
        title: "Défaut de paiement",
        body: "À l'échéance, l'établissement dispose d'un délai de grâce. Sans paiement, son compte passe en lecture seule, puis est suspendu. Les données sont supprimées 30 jours après la suspension, après rappels. Les factures sont conservées conformément aux obligations comptables. Aucune suspension n'est appliquée pendant les heures d'ouverture d'une agence.",
      },
      {
        title: "Obligations de l'établissement",
        body: "L'établissement s'engage à :\n- fournir des informations exactes (raison sociale, horaires, services, coordonnées) ;\n- informer ses visiteurs de l'utilisation de NextIn, notamment par l'affichage prévu à l'accueil ;\n- recueillir le consentement du visiteur avant de saisir son numéro de téléphone à l'accueil ;\n- ne demander que les informations nécessaires (nom, âge ou numéro de dossier selon son réglage) et respecter la confidentialité des données de ses visiteurs, en particulier les données de santé ;\n- utiliser NextIn conformément à la loi et ne pas tenter d'en contourner la sécurité ou les limites.",
      },
      {
        title: "Obligations du visiteur",
        body: "Le visiteur s'engage à fournir des informations exactes, à ne pas prendre de tickets fictifs ou en nombre abusif, et à se présenter lorsqu'il est appelé. Un ticket non présenté après appel peut être reculé puis annulé selon les règles de l'établissement. La priorité d'accès est accordée uniquement par le personnel de l'établissement.",
      },
      {
        title: "Publicité (NextIn Ads)",
        body: "10.1. Les publicités sont diffusées dans une zone distincte des écrans et de l'application. Elles ne masquent jamais les appels ni les informations de file d'attente.\n10.2. Chaque campagne est validée par Wintek avant diffusion. Wintek peut refuser ou retirer toute publicité contraire à la loi, trompeuse, choquante ou inadaptée au lieu de diffusion.\n10.3. Les publicités relevant de la santé ou de la pharmacie doivent disposer des autorisations exigées (visa).\n10.4. Un établissement peut refuser certains secteurs de publicité sur ses écrans.\n10.5. **Aucune publicité n'est ciblée à partir des données personnelles ou de santé des visiteurs.** Le ciblage repose uniquement sur la ville, le type d'établissement et les horaires.\n10.6. L'annonceur garantit qu'il détient les droits sur ses contenus. Les bons de réduction sont honorés par l'annonceur selon les conditions qu'il fixe.",
      },
      {
        title: "Disponibilité et responsabilité",
        body: "11.1. Wintek met en œuvre les moyens raisonnables pour assurer la disponibilité et la sécurité de NextIn. Le service dépend de réseaux et de prestataires (internet, électricité, opérateurs, WhatsApp, SMS, Mobile Money) que Wintek ne maîtrise pas.\n11.2. Les temps d'attente affichés sont des **estimations**. L'ordre de passage final reste décidé par l'établissement.\n11.3. Wintek n'est pas responsable de l'organisation de l'accueil, des soins ou des services rendus par l'établissement, ni du contenu des publicités des annonceurs.\n11.4. Sauf faute lourde ou disposition légale contraire, la responsabilité de Wintek envers un établissement est limitée au montant payé par cet établissement au cours des douze derniers mois.",
      },
      {
        title: "Propriété intellectuelle",
        body: "NextIn, son logo, ses interfaces et son code sont la propriété de Wintek. Les établissements et annonceurs conservent la propriété de leurs contenus (logos, photos, publicités) et accordent à Wintek le droit de les afficher pour les besoins du service.",
      },
      {
        title: "Données personnelles",
        body: "Le traitement des données personnelles est décrit dans la Politique de confidentialité, conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun.",
      },
      {
        title: "Suspension et résiliation",
        body: "L'établissement peut résilier à tout moment ; l'abonnement reste actif jusqu'à la fin de la période payée. Wintek peut suspendre un compte en cas de manquement grave aux présentes conditions, d'usage frauduleux ou de risque pour la sécurité, après information sauf urgence.",
      },
      {
        title: "Modification des conditions",
        body: "Wintek peut modifier les présentes conditions. Les établissements sont informés au moins 15 jours avant l'entrée en vigueur d'une modification importante. La version en vigueur est toujours accessible dans l'application.",
      },
      {
        title: "Droit applicable et litiges",
        body: "Les présentes conditions sont soumises au droit camerounais. En cas de litige, les parties recherchent d'abord une solution amiable. À défaut, les tribunaux compétents de Douala sont seuls compétents.",
      },
      {
        title: "Contact",
        body: "Pour toute question : contact@wintekservices.com — +237 690 72 23 16.",
      },
    ],
  },
    en: {
    title: "Terms of use",
    version: "Version 1.0 — effective [LAUNCH DATE]",
    notice: "Draft to be reviewed by a lawyer before publication.",
    translationNote: "Translation for information; the French version prevails.",
    sections: [
      {
        title: "Publisher",
        body: "NextIn is a service published by WINTEK (Winner Teknology), a company registered with the Douala trade and companies register under number RC/DLA/2021/A/1608, tax ID (NIU) [TO BE COMPLETED], with its registered office at Rond-point Poulenc, Makepe (opposite EEC), Douala, Cameroon.\nContact: contact@wintekservices.com — +237 690 72 23 16.",
      },
      {
        title: "Purpose",
        body: "These terms govern the use of NextIn, a platform for managing queues and reception areas, available on the web and on phones.\nThey apply:\n- to the **organizations** that subscribe to NextIn (clinics, banks, public services, companies…) and to their staff;\n- to the **visitors** who take a ticket or book an appointment with an organization;\n- to the **advertisers** who run advertising through NextIn Ads.\n\nUsing NextIn means accepting these terms.",
      },
      {
        title: "Definitions",
        body: "- **Organization**: a NextIn customer, responsible for welcoming its visitors.\n- **Visitor**: a person who takes a ticket, requests an appointment or checks the wait.\n- **Staff**: the organization's employees who have an account (administrator, manager, reception, agent, practitioner, cashier).\n- **Advertiser**: a professional who runs advertising on the screens and in the app.\n- **Plan**: the subscription offer chosen by the organization (Starter, Business, Premium or Enterprise).",
      },
      {
        title: "Access to the service",
        body: "4.1. Visitors use NextIn **free of charge and without creating an account**. The ticket is linked to the device used.\n4.2. A visitor can always get a ticket from the organization's reception, without a phone.\n4.3. Staff access NextIn with a personal account. Each user keeps their credentials confidential and reports any unauthorized use without delay.\n4.4. The organization is responsible for the accounts it creates, the rights it grants and the actions carried out by its staff.",
      },
      {
        title: "Description of the service",
        body: "NextIn notably provides: ticket taking by QR code, at reception or remotely; calling visitors to counters; display and voice announcements on screens; alerts by WhatsApp, SMS or notification; appointment management; statistics; advertising on screens and in the app.\nThe available features depend on the plan subscribed. Wintek may change the service; an essential feature of a paid plan will not be removed during a period without prior notice.",
      },
      {
        title: "Plans, prices and payment",
        body: "6.1. Prices are shown in CFA francs (FCFA), excluding taxes, on the Subscription page. They may change; any change applies to the following period, after the organization has been informed.\n6.2. Payment is made by Mobile Money (MTN Mobile Money, Orange Money) or any other means offered. The subscription is monthly or annual, with no commitment beyond the period paid.\n6.3. Each plan includes limits (branches, services, counters, screens, users, tickets and WhatsApp messages per month, length of history). Extensions can be purchased.\n6.4. **When a monthly limit is reached, the current queue is never interrupted**: the service continues until closing time that day. Taking new tickets may be paused from the next day, until the plan is changed, an extension is purchased or the next month begins.\n6.5. The Enterprise plan is subject to a quotation and a specific contract.\n6.6. Amounts paid for a period that has started are not refunded, unless the contract or the law provides otherwise. Installation fees and any equipment are invoiced separately.",
      },
      {
        title: "Late payment",
        body: "At the renewal date, the organization has a grace period. Without payment, its account becomes read-only, then suspended. Data is deleted 30 days after suspension, after reminders. Invoices are kept in accordance with accounting obligations. No suspension is applied during a branch's opening hours.",
      },
      {
        title: "Obligations of the organization",
        body: "The organization undertakes to:\n- provide accurate information (company name, opening hours, services, contact details);\n- inform its visitors that NextIn is used, in particular through the notice provided for the reception area;\n- obtain the visitor's consent before entering their phone number at reception;\n- request only the information that is necessary (name, age or file number depending on its settings) and respect the confidentiality of its visitors' data, in particular health data;\n- use NextIn in accordance with the law and not attempt to bypass its security or limits.",
      },
      {
        title: "Obligations of the visitor",
        body: "The visitor undertakes to provide accurate information, not to take fictitious or excessive numbers of tickets, and to come forward when called. A ticket not presented after being called may be moved back and then cancelled according to the organization's rules. Priority access is granted only by the organization's staff.",
      },
      {
        title: "Advertising (NextIn Ads)",
        body: "10.1. Advertising is shown in an area separate from the screens' and the app's queue information. It never hides calls or queue information.\n10.2. Each campaign is approved by Wintek before it runs. Wintek may refuse or remove any advertising that is unlawful, misleading, offensive or unsuited to the place where it is shown.\n10.3. Health or pharmacy advertising must hold the required authorizations (visa).\n10.4. An organization may refuse certain advertising sectors on its screens.\n10.5. **No advertising is targeted using visitors' personal or health data.** Targeting relies only on the city, the type of organization and the time of day.\n10.6. The advertiser warrants that it holds the rights to its content. Discount coupons are honored by the advertiser under the conditions it sets.",
      },
      {
        title: "Availability and liability",
        body: "11.1. Wintek uses reasonable means to ensure the availability and security of NextIn. The service depends on networks and providers (internet, electricity, operators, WhatsApp, SMS, Mobile Money) that Wintek does not control.\n11.2. Displayed waiting times are **estimates**. The final order of service is decided by the organization.\n11.3. Wintek is not responsible for the organization of reception, for the care or services provided by the organization, or for the content of advertisers' advertising.\n11.4. Except in the case of gross negligence or contrary legal provisions, Wintek's liability towards an organization is limited to the amount paid by that organization over the last twelve months.",
      },
      {
        title: "Intellectual property",
        body: "NextIn, its logo, its interfaces and its code are the property of Wintek. Organizations and advertisers keep ownership of their content (logos, photos, advertising) and grant Wintek the right to display it for the purposes of the service.",
      },
      {
        title: "Personal data",
        body: "The processing of personal data is described in the Privacy policy, in accordance with Law No. 2024/017 of 23 December 2024 on the protection of personal data in Cameroon.",
      },
      {
        title: "Suspension and termination",
        body: "The organization may terminate at any time; the subscription remains active until the end of the period paid. Wintek may suspend an account in the event of a serious breach of these terms, fraudulent use or a security risk, after notice except in an emergency.",
      },
      {
        title: "Changes to these terms",
        body: "Wintek may change these terms. Organizations are informed at least 15 days before a significant change takes effect. The version in force is always available in the app.",
      },
      {
        title: "Governing law and disputes",
        body: "These terms are governed by Cameroonian law. In the event of a dispute, the parties first seek an amicable solution. Failing that, the competent courts of Douala have exclusive jurisdiction.",
      },
      {
        title: "Contact",
        body: "For any question: contact@wintekservices.com — +237 690 72 23 16.",
      },
    ],
  },
  },
  privacy: {
    fr: {
    title: "Politique de confidentialité",
    version: "Version 1.0 — en vigueur le [DATE DE MISE EN LIGNE]",
    notice: "Projet à faire relire par un juriste avant publication.",
    sections: [
      {
        title: "Qui sommes-nous ?",
        body: "NextIn est édité par WINTEK (Winner Teknology), RC/DLA/2021/A/1608, Rond-point Poulenc, Makepe (face EEC), Douala, Cameroun. Contact pour vos données : contact@wintekservices.com — +237 690 72 23 16.\n\nCette politique respecte la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun.",
      },
      {
        title: "Qui est responsable de vos données ?",
        body: "- **Données des visiteurs** (ticket, nom, numéro de téléphone, rendez-vous) : l'**établissement** que vous visitez en est responsable. Wintek les traite **pour son compte et selon ses instructions**, uniquement pour faire fonctionner le service.\n- **Données des comptes** (personnel des établissements, annonceurs) et **facturation** : Wintek en est responsable.",
      },
      {
        title: "Quelles données, et pourquoi ?",
        body: "### Visiteurs\n| Donnée | Pourquoi | Obligatoire ? |\n|---|---|---|\n| Ticket (numéro, service, heures, statut) | Gérer votre place dans la file | Oui |\n| Identifiant technique de l'appareil (session anonyme) | Retrouver votre ticket sans créer de compte | Oui |\n| Nom, et selon l'établissement âge ou numéro de dossier | Permettre au personnel de savoir qui il reçoit | Selon le réglage de l'établissement |\n| Numéro WhatsApp ou de téléphone | Vous prévenir quand votre tour approche, confirmer un rendez-vous | Non, seulement si vous le choisissez |\n| Position du téléphone | Calculer la distance et le moment de partir pour un ticket à distance | Non. **Jamais enregistrée** : seule une durée de trajet estimée est gardée |\n| Note et commentaire après le passage | Améliorer le service de l'établissement | Non |\n| Parties de jeu, bons de réduction | Vous proposer un jeu et un bon pendant l'attente | Non |\n\n### Personnel et annonceurs\nNom, e-mail, téléphone, rôle, agences attribuées, journal des actions sensibles (sécurité), informations de facturation.\n\n### Ce que nous ne faisons jamais\n- Votre **nom n'est jamais affiché sur l'écran de la salle, jamais annoncé** et jamais envoyé par WhatsApp ou SMS. Seul le numéro du ticket est appelé.\n- Vos données ne sont **jamais vendues**.\n- **Aucune publicité n'est ciblée à partir de vos données personnelles ou de santé.** Les annonceurs ne reçoivent que des statistiques anonymes (affichages, clics, bons utilisés).",
      },
      {
        title: "Qui peut voir vos données ?",
        body: "- Le **personnel de l'établissement** que vous visitez, et seulement celui de l'agence concernée.\n- Les **équipes Wintek** pour la maintenance et l'assistance, avec un accès limité et journalisé. La console Wintek n'a pas accès aux noms des visiteurs.\n- Nos **prestataires techniques**, uniquement pour faire fonctionner le service : hébergement et base de données (Supabase, Vercel), messagerie (Meta / WhatsApp, fournisseur SMS [À COMPLÉTER]), paiement Mobile Money ([NOTCH PAY / CINETPAY]), protection anti-robot (Cloudflare).\n- Les autorités, si la loi l'exige.\n\nCertains prestataires hébergent les données hors du Cameroun ([RÉGION D'HÉBERGEMENT À COMPLÉTER]). Ces transferts sont encadrés par des garanties contractuelles et réalisés conformément à la loi.",
      },
      {
        title: "Combien de temps ?",
        body: "- **Nom, numéro de téléphone, commentaires, lien du ticket** : supprimés automatiquement **30 jours** après le passage (durée réglable par l'établissement, dans les limites de la loi). Il ne reste ensuite que des statistiques anonymes.\n- **Numéros ayant demandé l'arrêt des messages (STOP)** : conservés uniquement sous forme d'empreinte irréversible (le numéro lui-même n'est pas lisible), pour respecter ce choix.\n- **Comptes du personnel** : pendant la durée de l'abonnement, puis supprimés 30 jours après la suspension de l'établissement.\n- **Factures** : conservées pendant la durée exigée par les obligations comptables.",
      },
      {
        title: "Sécurité",
        body: "Données chiffrées pendant leur transport ; séparation stricte entre établissements (chaque établissement ne voit que ses propres données) ; accès par rôle ; journal des actions sensibles ; limitation des tentatives abusives ; masquage du nom des visiteurs sur l'écran du poste après quelques minutes sans activité.\nEn cas d'incident touchant vos données, Wintek prévient sans délai l'établissement concerné et l'autorité compétente, comme la loi le prévoit.",
      },
      {
        title: "Vos droits",
        body: "Vous pouvez demander à **accéder** à vos données, les **corriger**, les **supprimer**, vous **opposer** à leur traitement ou **retirer votre consentement** (par exemple aux messages WhatsApp : répondez STOP).\n- Pour une donnée liée à votre visite : adressez-vous à l'établissement, ou écrivez-nous, nous transmettrons.\n- Pour un compte du personnel ou d'annonceur : écrivez à contact@wintekservices.com.\nNous répondons dans le délai prévu par la loi. Vous pouvez aussi saisir l'autorité camerounaise de protection des données.",
      },
      {
        title: "Cookies et stockage sur l'appareil",
        body: "NextIn utilise uniquement des éléments **techniques nécessaires** : maintien de la connexion, langue, apparence (clair ou sombre), ticket en cours, nom mémorisé sur votre téléphone si vous l'avez saisi. Aucun cookie publicitaire ni de suivi d'un site à l'autre.",
      },
      {
        title: "Mineurs",
        body: "NextIn ne demande pas d'informations sur l'âge des visiteurs, sauf si l'établissement l'exige pour son accueil (par exemple une clinique). Les données d'un mineur sont alors saisies et traitées sous la responsabilité de l'établissement et de son représentant légal.",
      },
      {
        title: "Modifications",
        body: "Cette politique peut évoluer. La version en vigueur est toujours accessible dans l'application, avec sa date.",
      },
      {
        title: "Contact",
        body: "contact@wintekservices.com — +237 690 72 23 16 — Wintek, Rond-point Poulenc, Makepe (face EEC), Douala.",
      },
    ],
  },
    en: {
    title: "Privacy policy",
    version: "Version 1.0 — effective [LAUNCH DATE]",
    notice: "Draft to be reviewed by a lawyer before publication.",
    translationNote: "Translation for information; the French version prevails.",
    sections: [
      {
        title: "Who are we?",
        body: "NextIn is published by WINTEK (Winner Teknology), RC/DLA/2021/A/1608, Rond-point Poulenc, Makepe (opposite EEC), Douala, Cameroon. Contact for your data: contact@wintekservices.com — +237 690 72 23 16.\n\nThis policy complies with Law No. 2024/017 of 23 December 2024 on the protection of personal data in Cameroon.",
      },
      {
        title: "Who is responsible for your data?",
        body: "- **Visitor data** (ticket, name, phone number, appointments): the **organization** you visit is responsible for it. Wintek processes it **on the organization's behalf and according to its instructions**, solely to run the service.\n- **Account data** (organization staff, advertisers) and **billing**: Wintek is responsible for it.",
      },
      {
        title: "What data, and why?",
        body: "### Visitors\n| Data | Why | Required? |\n|---|---|---|\n| Ticket (number, service, times, status) | Managing your place in the queue | Yes |\n| Technical device identifier (anonymous session) | Finding your ticket again without creating an account | Yes |\n| Name, and depending on the organization age or file number | Letting staff know who they are receiving | Depending on the organization's settings |\n| WhatsApp or phone number | Letting you know when your turn is near, confirming an appointment | No, only if you choose to |\n| Phone location | Calculating the distance and when to leave for a remote ticket | No. **Never stored**: only an estimated travel time is kept |\n| Rating and comment after your visit | Improving the organization's service | No |\n| Games played, discount coupons | Offering you a game and a coupon while you wait | No |\n\n### Staff and advertisers\nName, email, phone, role, assigned branches, log of sensitive actions (security), billing information.\n\n### What we never do\n- Your **name is never shown on the waiting-room screen, never announced** and never sent by WhatsApp or SMS. Only the ticket number is called.\n- Your data is **never sold**.\n- **No advertising is targeted using your personal or health data.** Advertisers receive only anonymous statistics (views, clicks, coupons used).",
      },
      {
        title: "Who can see your data?",
        body: "- The **staff of the organization** you visit, and only those of the branch concerned.\n- **Wintek teams** for maintenance and support, with limited and logged access. The Wintek console has no access to visitors' names.\n- Our **technical providers**, solely to run the service: hosting and database (Supabase, Vercel), messaging (Meta / WhatsApp, SMS provider [TO BE COMPLETED]), Mobile Money payment ([NOTCH PAY / CINETPAY]), anti-bot protection (Cloudflare).\n- The authorities, where the law requires it.\n\nSome providers host data outside Cameroon ([HOSTING REGION TO BE COMPLETED]). These transfers are covered by contractual safeguards and carried out in accordance with the law.",
      },
      {
        title: "How long?",
        body: "- **Name, phone number, comments, ticket link**: automatically deleted **30 days** after your visit (period adjustable by the organization, within the limits of the law). After that, only anonymous statistics remain.\n- **Numbers that asked to stop messages (STOP)**: kept only as an irreversible fingerprint (the number itself cannot be read), to respect that choice.\n- **Staff accounts**: for the duration of the subscription, then deleted 30 days after the organization is suspended.\n- **Invoices**: kept for the period required by accounting obligations.",
      },
      {
        title: "Security",
        body: "Data encrypted in transit; strict separation between organizations (each organization sees only its own data); role-based access; log of sensitive actions; limits on abusive attempts; visitors' names hidden on the desk screen after a few minutes of inactivity.\nIn the event of an incident affecting your data, Wintek informs the organization concerned and the competent authority without delay, as required by law.",
      },
      {
        title: "Your rights",
        body: "You can ask to **access** your data, **correct** it, **delete** it, **object** to its processing or **withdraw your consent** (for example to WhatsApp messages: reply STOP).\n- For data linked to your visit: contact the organization, or write to us and we will pass your request on.\n- For a staff or advertiser account: write to contact@wintekservices.com.\nWe reply within the period set by law. You may also refer the matter to the Cameroonian data protection authority.",
      },
      {
        title: "Cookies and on-device storage",
        body: "NextIn uses only **strictly necessary technical** items: keeping you signed in, language, appearance (light or dark), current ticket, and the name remembered on your phone if you entered it. No advertising cookies and no cross-site tracking.",
      },
      {
        title: "Minors",
        body: "NextIn does not ask for visitors' age, unless the organization requires it for its reception (for example a clinic). A minor's data is then entered and processed under the responsibility of the organization and of the minor's legal representative.",
      },
      {
        title: "Changes",
        body: "This policy may change. The version in force is always available in the app, with its date.",
      },
      {
        title: "Contact",
        body: "contact@wintekservices.com — +237 690 72 23 16 — Wintek, Rond-point Poulenc, Makepe (opposite EEC), Douala.",
      },
    ],
  },
  },
};

/** Vrai tant qu'un article attend son contenu. */
export function isLegalDraft(doc: LegalDocument): boolean {
  return doc.sections.some((s) => !s.body.trim());
}

/** Mentions à compléter ([À COMPLÉTER], [DATE DE MISE EN LIGNE]…) restant dans un document. */
export function legalPlaceholders(doc: LegalDocument): string[] {
  const text = [doc.version, ...doc.sections.map((s) => s.body)].join("\n");
  return [...new Set(text.match(/\[[^\]\n]+\]/g) ?? [])];
}

export type LegalInline = { text: string; bold?: boolean; placeholder?: boolean };
export type LegalBlock =
  | { kind: "p"; inlines: LegalInline[] }
  | { kind: "h3"; text: string }
  | { kind: "list"; items: LegalInline[][] }
  | { kind: "table"; head: LegalInline[][]; rows: LegalInline[][][] };

/** Texte en ligne : **gras** et mentions entre crochets (surlignées). */
export function parseInline(text: string): LegalInline[] {
  const out: LegalInline[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const bold = part.startsWith("**") && part.endsWith("**");
    const raw = bold ? part.slice(2, -2) : part;
    for (const piece of raw.split(/(\[[^\]\n]+\])/g)) {
      if (!piece) continue;
      out.push({ text: piece, ...(bold ? { bold: true } : {}), ...(/^\[[^\]]+\]$/.test(piece) ? { placeholder: true } : {}) });
    }
  }
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

/** Corps d'un article → blocs : une ligne = un paragraphe, listes « - », sous-titres « ### », tableaux Markdown. */
export function parseLegalBody(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("- ")) {
      const items: LegalInline[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("- ")) {
        items.push(parseInline(lines[i]!.trim().slice(2)));
        i++;
      }
      i--;
      blocks.push({ kind: "list", items });
    } else if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        rows.push(lines[i]!.trim());
        i++;
      }
      i--;
      const [head, , ...rest] = rows;
      blocks.push({ kind: "table", head: cells(head ?? ""), rows: rest.map(cells) });
    } else {
      blocks.push({ kind: "p", inlines: parseInline(line) });
    }
  }
  return blocks;
}
