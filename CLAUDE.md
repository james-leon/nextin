# NextIn by Wintek — conventions du projet

Plateforme SaaS de files d'attente virtuelles (Cameroun) : PWA web d'abord, app Expo au M11.
Plan d'architecture validé : `docs/PLAN.md`. Notes de module : `docs/modules/`. Améliorations reportées à la fin : `docs/BACKLOG.md`.

## Règles absolues
- **Aucun secret dans le code ni dans Git.** Variables listées dans `.env.example` (sans valeurs). Les fichiers `.env*` (sauf `.env.example`) et `supabase/.env` sont ignorés.
- **Jamais d'URL en dur** : toute URL absolue passe par `getAppUrl()` / `absoluteUrl()` (`@nextin/shared`), qui lisent `APP_URL`.
- **Un module à la fois** (M1 → M11), arrêt et validation à la fin de chaque module.
- **Migrations progressives** : un module ne crée que les tables dont il a besoin.
- Code complet uniquement, pas de TODO non signalé. Messages de commit clairs, en anglais, à l'impératif.
- Nom du client : visible **du seul personnel de l'agence** (RLS). Jamais annoncé, affiché sur l'écran TV, envoyé (WhatsApp / SMS), diffusé en temps réel public, mis dans les statistiques ni dans le journal d'audit.

## Monorepo
- `apps/web` — Next.js 16 (App Router, Turbopack), Tailwind v4, composants maison façon shadcn (Radix + cva), next-intl.
- `packages/shared` — types (dont `src/types/database.ts` généré), schémas Zod, logique métier pure, i18n FR/EN.
- `packages/payments` — contrat `PaymentProvider` des agrégateurs Mobile Money et faux fournisseur (M10a), côté serveur uniquement.
- `supabase/` — `migrations/` (SQL horodaté `YYYYMMDDHHMMSS_mX_sujet.sql`), `tests/database/*.test.sql` (pgTAP).
- `scripts/` — Node uniquement (compatibles Windows) : `seed-demo.ts` (idempotent, images générées par `demo-images.ts`), `local-env.mjs`, `db-reset.mjs`, `db-test.mjs`, `db-integration.mjs`, `db-types.mjs`, `supabase-remote.mjs`, `dev-lan.mjs`, `screenshots.mjs`, `generate-voices.ts`, `e2e-cleanup.mjs`. Jamais de `bash`, `env -u` ni `$VAR` dans les scripts `package.json`.
- Identifiants (tables, colonnes, code) en **anglais** ; interface en **français** par défaut, anglais en bascule ; commentaires en français.

## Commandes
| | |
|---|---|
| `pnpm dev` / `pnpm build` | app web |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | ESLint, TypeScript, Vitest (tous les paquets) |
| `pnpm test:e2e` | Playwright (après `pnpm build`) — projets `mobile` et `desktop` |
| `pnpm --filter @nextin/web screenshots` | captures (`scripts/screenshots.mjs`, tests `@screenshots`) → `docs/captures/<module>/` |
| `pnpm db:start` · `pnpm db:reset` · `pnpm db:test` · `pnpm db:types` | Supabase local (Docker, avec Realtime), tests pgTAP puis intégration (`supabase/tests/integration`, `node:test`), types TS. `db:reset` redémarre aussi Kong (cache DNS de Realtime) ; `db:test:sql` = pgTAP seul |
| `pnpm db:link` · `pnpm db:push` | lier et migrer le projet distant (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`) |
| `pnpm seed:demo` | DOUALA CLINIC + Eneo Douala (`SEED_DEMO_PASSWORD` requis) |
| `pnpm voices:generate` | voix des annonces TV (ElevenLabs → bucket `voices`, idempotent ; `--dry-run`, `--lang fr`) |
| `pnpm notify:configure` · `pnpm notify:outbox` · `pnpm whatsapp:simulate "NEXTIN C-001 AbC1"` | notifications : réveil de l'expéditeur par la base (après déploiement), derniers messages de la file, message WhatsApp simulé (signé, en local) |
| `pnpm e2e:local` | build + Playwright contre le Supabase local |
| `pnpm dev:lan` · `pnpm dev:lan --remote` | test sur téléphone (même Wi-Fi) : `APP_URL` sur l'IP du PC, Supabase local (Docker) ou distant (`--remote` : URL et clés de `apps/web/.env.local` ; « Allow anonymous sign-ins » activé dans Supabase Auth) |

En local, la CLI Supabase lit `SUPABASE_DB_PASSWORD` s'il est défini : les scripts `db:*` locaux passent par `scripts/local-env.mjs`, qui le retire.
Captcha : désactivé en local et en CI (Cloudflare injoignable depuis les conteneurs) ; activé en production dès que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` sont présentes (et dans Supabase Auth). Un `APP_URL` public sans clé est refusé. **En local : aucune clé, ou les clés de test officielles de Cloudflare** (secret `1x0000…AA` : l'action n'est pas vérifiée, leur réponse n'en contient pas).
Tests et dev **contre le Supabase local** : préfixer par `node scripts/local-env.mjs` (retire les variables du projet distant, qui priment sur `.env.local`) ; `pnpm dev:local`, `pnpm e2e:local` (build + Playwright), `pnpm seed:demo:local`. `pnpm seed:demo` charge `apps/web/.env.local` s'il existe.

## Base de données et sécurité
- RLS activée sur **toutes** les tables (vérifié par pgTAP). Isolation par `organization_id` présent sur chaque table métier.
- Fonctions d'autorisation `SECURITY DEFINER`, `set search_path = ''` : `is_platform_admin()`, `has_org_role(org, roles)`, `can_access_branch(org, branch, roles)`, `can_manage_member(org, branch, role)`.
- Écritures sensibles **uniquement via RPC** `SECURITY DEFINER` (pas de policy INSERT/UPDATE directe sur les tables critiques). `EXECUTE` révoqué par défaut sur les fonctions (révocation **globale** pour `postgres`, migration `20261117090000`) : accorder explicitement. Le rôle `anon` n'exécute qu'une liste fermée (pages publiques), vérifiée par `security.test.sql` : toute nouvelle fonction publique y est ajoutée.
- Sécurité (`docs/NEXTIN_SECURITY_AND_PRIVACY.md`, procédure d'incident comprise) : en-têtes et CSP dans `lib/security/headers.ts` (toute nouvelle origine externe y est déclarée, `e2e/security.spec.ts` échoue sinon ; pas d'en-têtes de document sur `/api` ni `/_next/static`, budget 200 Ko) ; cookies de session `Secure` en HTTPS (`sessionCookieOptions`) ; appels hors ordre journalisés (`ticket.call_out_of_order`) ; `pnpm audit --prod` propre avant toute mise en production.
- Sessions anonymes (clients) : rôle `authenticated` + claim `is_anonymous` — toujours les exclure des droits du personnel (`public.is_anonymous()`).
- Journal d'audit append-only (`public.audit(...)`) pour toute action sensible. Rate limiting : `public.check_rate_limit(key, max, window)`.
- Session du personnel vérifiée par `auth.getUser()` **partout** (proxy et `requireStaffSession`) ; une session refusée par Supabase est effacée localement par le proxy (jamais de boucle /login ↔ /app, test `e2e/session.spec.ts`).
- Redirections après connexion uniquement via `safeNextPath` (jamais de redirection ouverte). Server actions : Zod puis `ActionResult` avec des codes d'erreur du dictionnaire `errors`.
- Validation Zod côté client **et** serveur (schémas dans `@nextin/shared/schemas`). Turnstile vérifié côté serveur (`lib/security/turnstile.ts`).
- Données personnelles purgées après `organizations.data_retention_days` (défaut 30 j) — statistiques anonymisées uniquement.
- Chaque nouvelle table : RLS + policies + test pgTAP d'isolation entre deux organisations.
- Tables rattachées à une agence : `organization_id` + clé étrangère composite `(organization_id, branch_id)` vers `branches(organization_id, id)` (cohérence multi-tenant garantie par la base).
- **Abonnements (M10a, `docs/PLAN.md` §11)** : aucun prix, quota ni limite de formule en dur — tout vient de `plans` / `platform_settings` (modifiables par le super admin). Limites vérifiées côté serveur (`org_entitlements`). Aucune dégradation d'abonnement appliquée pendant les heures d'ouverture. Webhooks de paiement signés et idempotents. Factures jamais supprimées.

## Design — Apple Human Interface Guidelines (obligatoire)
Vitrine de référence : `/design` (`components/design/design-showcase.tsx`). Tokens : `apps/web/app/globals.css`.
- **Principes** : clarté, déférence au contenu, profondeur. **Une action principale par écran.** Beaucoup d'espace blanc, hiérarchie typographique forte.
- **Polices de SchoolMaster** (`app/fonts.ts`, `next/font/local`, fichiers Google Fonts OFL réduits au latin dans `app/fonts/`, aucune requête vers Google) : **Sora** (600–800) pour les grands titres et titres de section (`h1`, `h2` par défaut, classe `font-display`), **Inter** pour tout le texte (`font-sans`). Variables `--app-font-sans` / `--app-font-display`. Pages client et `/pay` : police système au premier affichage, Inter/Sora après chargement (`FontsAfterLoad` → `data-fonts-ready`) pour tenir le budget de 200 Ko — ne jamais précharger ces polices.
- **Typo** : échelle iOS en `rem` (suit la taille de texte de l'utilisateur) : `text-large-title` 34, `text-title1` 28, `text-title2` 22, `text-title3` 20, `text-headline` 17 semibold, `text-body` 17, `text-callout` 16, `text-subheadline` 15, `text-footnote` 13, `text-caption` 12, `text-hero` pour le numéro de ticket. Chiffres : `tabular`.
- **Couleurs** : uniquement via tokens sémantiques (`bg-grouped`, `bg-grouped-secondary`, `text-label`, `text-label-secondary`, `bg-separator`, `bg-fill-*`…). Jamais de couleur en dur dans un composant.
- Accents Wintek **avec parcimonie** (aligné sur SchoolMaster) : **bouton principal en bleu nuit** `bg-primary` (Navy `#0D2C54`, texte blanc ; `#2A6FB5` en sombre, le navy disparaissant sur le noir) — c'est la variante `filled` de `Button`/`IconButton` ; Blue `#1A6BB5` = **liens, focus, boutons secondaires et sélections** (gardé plutôt que le #2563EB de SchoolMaster : 5,5:1 sur blanc contre 5,2:1) (`bg-accent` pour une pastille, un onglet ou une case active, `text-accent-text`, `text-accent-on-tint` sur fond teinté) ; Orange `#F58B1F` (attention), Green `#15A05A` (succès). Orange/Green en fond ou icône ; pour du texte, utiliser `text-orange-text` / `text-green-text` (AA), sauf sur le bleu nuit où `text-orange` passe (5,7:1).
- `text-label-tertiary` : icônes, chevrons, placeholders seulement — jamais pour du texte informatif (contraste).
- **Formes (style A, validé)** : fond `#F7F9FC`, cartes blanches, bordures et séparateurs `#E8EDF4`, rayon de base 12 px (champs, boutons), rayons continus (`--radius-xl` 24 px pour les cartes, `--radius-2xl` 28 px pour les héros : ticket, établissement à la une, client en cours) + `squircle`, ombre très douce `shadow-card` (0 8px 30px rgba(13,44,84,0.06)), séparateurs 0,5 px (`hairline-*`). Écrans principaux en cartes et grilles ; les listes groupées (rayon 16 px) restent pour les réglages.
- **Composants** (`components/ui`) : `Button` (filled/tinted/gray/plain/destructive/destructive-plain/navy, `leadingIcon`/`trailingIcon`), `IconButton` (label obligatoire), `ListSection`/`ListRow`/`ListSwitchRow`, `Card`, `StatCard`, `CalloutCard`, `Switch`, `SegmentedControl`, `TextField`/`SearchField`, `NavigationBar` (`large` avec sur-titre et grand titre réductible, ou `inline` ; retour en haut à gauche), `TabBar` (translucide, en bas sur mobile ; `floating` pour les pages client : pilule de 64 px, onglet actif en pilule bleue avec libellé, les autres en icône seule), `BottomBar` (action principale : fixe en bas sur téléphone, à la largeur du contenu sur tablette, dans la barre de titre sur ordinateur via `PageFrame`), `DataTable` (tableau sur ordinateur), `CheckPicker` (longue liste à cocher avec recherche), `IconLink` (« + » d'une liste), `Sheet` (vaul), `AlertDialog`, `Badge` (`pill` pour un statut, `tag` pour une étiquette)/`StatusDot`, `ProgressBar`, `Skeleton`, `Spinner`, `ToastProvider`, `TicketHero`, `NowServingCard`, `ServiceTile`, `ScannerFrame`, `Logo`/`LogoMark`. Réutiliser avant de créer.
- **Mouvement** : ressort CSS `ease-[var(--ease-spring)]`, 200–420 ms, jamais gratuit ; retour tactile immédiat (`pressable`) ; `prefers-reduced-motion` respecté.
- **Clair et sombre** sur chaque écran (`data-theme` sur `<html>`, préférence Auto/Clair/Sombre).
- **Accessibilité** : cibles ≥ 44 px (testé), contrastes AA (axe testé en clair et sombre), `aria-label` sur tout bouton icône, libellés associés aux champs, navigation clavier (`:focus-visible`), rôles ARIA corrects (ex. `ListSection radioGroupLabel` pour les choix exclusifs).
- **Icônes** : lucide au trait fin (style SF Symbols), `aria-hidden` si décoratives. **Jamais d'emoji.**
- **Client** : le numéro de ticket (76 px, `text-hero`) et l'attente estimée sont les héros visuels ; « Mon ticket » : badge « En direct » et carte « Votre position » (`QueuePosition`, numéros publics seulement, jamais de nom). « À proximité » : catégories par secteur, établissement le plus proche en grande carte avec photo (`branch-photos`, téléversée par le directeur, recadrée 16:9 et carrée dans le navigateur, 1 Mo), suivants en lignes avec vignette ; sans photo, icône du secteur sur fond teinté. Pages client < 200 Ko au premier chargement, utilisables en 3G : RSC, JS client minimal, pas de bibliothèque d'animation.
- **Maquette de référence** : `design/mockups/` (exports Claude Design) — à suivre fidèlement. 01 scanner (toujours sombre, `bg-scanner`), 02 choisir un service, 03 mon ticket, 04 agent/guichet, 05 écran TV (`bg-tv`), 06 tableau de bord, 07 chevalet A5, 08 affiche A4, 09 parcours. Les écrans 01 à 04 sont reconstruits dans `/design` (section « Écrans de la maquette ») : partir de ces compositions pour les vrais écrans.
- **Ticket** : format `C-047` (`formatTicketCode`), numéro en Navy (`text-ticket-number`, blanc en sombre), graisse extra-bold, jamais en chiffres tabulaires (le tiret s'élargirait). Couleurs de service : palette `SERVICE_COLORS` (pastille lettre, texte blanc).
- **Listes groupées** : séparateurs inset (`list-separator`) alignés sur le texte après la pastille, jamais sous la dernière ligne ; seul le `<li>` porte `group/row`.
- **Mon ticket** : « Recevoir mes alertes sur WhatsApp » (tinted, icône message) juste sous la carte du ticket ; actions du bas dans `TicketBottomActions` (BottomBar toujours visible) ; « Je suis en route » uniquement si `canSignalOnMyWay(source)` (ticket à distance).
- **Marque** (logo « bleu vif », sources `design/logo/`, fichiers servis `apps/web/public/brand/`) : géométrie unique dans `lib/brand/logo-data.ts`. Web : SVG en ligne (sans requête) — `Logo` = logo horizontal « NextIn by Wintek » (mot-symbole par jetons `--logo-name` / `--logo-tagline` : version claire sur fond clair, sombre en thème sombre ; `tone="inverse"` = version sombre forcée sur le bleu nuit de la connexion et l'écran TV), `LogoMark` = icône arrondie seule quand la place manque. Pages client au budget serré : `LogoImage` (`components/ui/logo-image.tsx`, fichiers SVG en `loading="lazy"`, chargés seulement s'ils s'affichent). PDF : `PdfLogo` (`lib/pdf/brand.tsx`, vectoriel ; `Defs` directement sous `Svg`, dégradés en remplissage seulement). Icônes PWA (`public/icons/`) générées depuis les SVG : `icon-512`/`icon-192` (icône pleine), `icon-maskable-512`, `apple-touch-icon` 180 (opaque), `favicon-32`/`favicon-16` + `brand/nextin-favicon.svg` (N seul), `badge-96` (N blanc, notifications). Ne jamais redessiner le logo : partir des fichiers de `design/logo/`.
- **Connexion du personnel** (`app/(auth)/layout.tsx`, partagé avec l'inscription, l'invitation et « Nouveau mot de passe ») : sur ordinateur, panneau de marque bleu nuit (`from-navy to-navy-deep`, sur-titre orange, grand titre `font-display`, trois avantages, copyright) et formulaire sur fond `bg-grouped` ; sur téléphone et tablette, formulaire seul. Bascule FR / EN (`LocaleSwitch`) en haut à droite. En-tête `AuthHeader`, pied `SecureNotice` + `LegalFooter`.
- « Se souvenir de moi » (cochée par défaut) : décochée, cookie marqueur `nextin_session_only` → cookies Supabase sans `maxAge` (`sessionOnly`, `lib/auth/session-cookies.ts`), appliqué aussi par le proxy. « Mot de passe oublié ? » = connexion par code e-mail puis `/reset-password` (`resetPassword`, `passwordSchema`, confirmation). CGU et confidentialité : `/cgu`, `/confidentialite` (FR/EN selon la langue), textes de `docs/NEXTIN_CGU.md` et `docs/NEXTIN_CONFIDENTIALITE.md` recopiés tels quels dans `lib/legal/documents.ts` (un article par section, corps en markdown restreint : paragraphes, `###`, listes, tableaux, `**gras**`) ; version en tête, mentions `[À COMPLÉTER]` surlignées, EN avec « the French version prevails » ; test de concordance avec les `.md` (`documents.test.ts`).

## Back-office (`/app/o/[orgId]/…`)
- Contexte et droits : `getOrgContext(orgId)` (`lib/admin/context.ts`), `getBranch(orgId, branchId)` ; 404 si l'établissement ou l'agence n'est pas accessible.
- Mutations : server actions dans `app/(staff)/app/o/[orgId]/_actions/` (Zod → Supabase sous RLS → `revalidatePath` → redirection `?saved=1`). Toujours `.select(...)` après un update/delete et refuser si aucune ligne n'est touchée (RLS silencieuse).
- Gabarit `AdminPage` (large par défaut : `max-w-7xl`, marges 16/32/40 px ; `narrow` réservé aux formulaires purs), formulaires clients avec `useActionState` + `useFormErrors`, action principale dans `BottomBar` (remontée dans la barre de titre sur ordinateur ; un bouton d'envoi y reste relié à son formulaire), confirmations par `ConfirmAction`.
- Listes du back-office : maître-détail par un `layout.tsx` (`MasterDetail`, `SplitListPane`, `SplitRow`, `SplitPlaceholder` ; détail en `AdminPage inSplit`) ou tableau (`DataTable`) sur ordinateur ; jamais une liste étirée sur 1 200 px.
- PDF : `@react-pdf/renderer` (`lib/pdf/`), police Inter embarquée ; QR codes vectoriels via `qrMatrix` (`lib/qr/matrix.ts`), URL toujours `qrEntryUrl(token)`.

## File d'attente (M3, `docs/modules/M3.md`)
- États : `waiting` → `called` (« Alerter le suivant ») → `serving` (« Admettre », chrono `serving_started_at`) → `served` ; `no_show`, `cancelled`, `transferred`. Durées mesurées de l'admission à la fin, jamais depuis l'alerte.
- Un seul ticket `called`/`serving` par poste (index unique) ; `call_next` refuse `counter_busy` tant que le patient alerté n'est pas traité ; `FOR UPDATE SKIP LOCKED`.
- Commandes des postes idempotentes via `p_client_op_id` (rejeu hors ligne) ; toute écriture sur `tickets` passe par une RPC.
- Prise de ticket client : `POST /api/tickets` uniquement (Zod → session cookie ou Bearer → `throttle_ticket_request` → Turnstile → `take_ticket` en service role). Ne jamais exposer `take_ticket` au client.
- **Priorité accordée par le personnel uniquement** : `set_ticket_priority` (« Rendre prioritaire » dans la feuille du ticket à l'accueil, menu « … » au poste, `PrioritySheet`), création à l'accueil, arrivée d'un rendez-vous. `take_ticket` / `take_remote_ticket` refusent tout motif (`priority_staff_only`) ; motifs dans `priorityReasons`.
- Erreurs métier : message = code (`counter_busy`, `branch_closed`…), SQLSTATE `P04xx` ; `queueErrorCode` / `mapDbError` → dictionnaire `errors`.
- Estimation : `packages/shared/src/queue/estimate.ts` et `public.estimate_wait_seconds` doivent rester identiques (fixtures partagées, test de parité).
- Temps réel : topics de `@nextin/shared/queue` (`boardTopic`, `ticketTopic`, `staffTopic`), alimentés par les déclencheurs SQL ; jamais de nom ni d'identifiant client dans une diffusion.

## Pages client (M4, `docs/modules/M4.md`)
- `app/(client)` : `/` scanner, `/c` code, `/q/[code]` choix du service, `/t/[token]` ticket, `/t` onglet, `/profile`. RSC + petits composants client.
- **Budget < 200 Ko** (test Playwright) : pas de supabase-js ni de next-intl côté navigateur sur ces pages. Utiliser `lib/client/*` (`callRpc`, `subscribeBroadcast`, session anonyme, `takeTicket`) et `useLiteT` / `useLiteLocale` (`lib/i18n/lite.tsx`) ; importer `@nextin/shared/queue/live` (sans Zod) plutôt que `@nextin/shared/queue`. Charger à la demande (`next/dynamic`) ce qui ne sert pas au premier affichage.
- Textes : le gabarit client ne transmet que `common` et `client.tabs` ; chaque page entoure ses composants client de `LiteMessages paths={[…]}` (`lib/i18n/lite-server.tsx`) avec les seuls espaces de noms qu'ils utilisent (les fournisseurs imbriqués se complètent).
- Pas de `crypto.randomUUID`, caméra ni presse-papiers sans repli : le test en Wi-Fi local est en `http`.
- `Preferences` (apparence + langue) reçoit ses textes du serveur (`preferencesLabels()`). La déconnexion du personnel est dans `/app/settings`.

## Postes (M5, `docs/modules/M5.md`)
- `/desk` (choix), `/desk/counter/[counterId]` (agent, maquette 04), `/desk/reception/[branchId]` (accueil), `/desk/print/[ticketId]` (ticket 80/58 mm).
- **Un seul bouton principal** dont le rôle suit `primaryAction` (`@nextin/shared/desk`) : Ouvrir → Alerter le suivant → Admettre → Terminer et alerter le suivant.
- Hors ligne : `useDesk` (copie de la file + commandes en attente en IndexedDB, `lib/desk/*`), application locale par `applyOp`, rejeu ordonné ; appel hors ligne = `call_ticket` (conflit → suivant disponible + bandeau). Identifiants de commande : `uuidV4()` (jamais `crypto.randomUUID`).
- Postes du personnel : supabase-js autorisé (pas de budget), canal privé `staffTopic` + interrogation de secours.
- Numéro WhatsApp saisi à l'accueil : uniquement avec consentement (`consent_required`), table `notification_contacts`, purgée avec les données personnelles.
- Absence d'un praticien : réorientation vers un collègue de même spécialité (`reroute_counter`) ; retard : patients gardés, attente ≥ retour prévu (`practitioner_late_until`).

## Rendez-vous (M5b, `docs/modules/M5b.md`)
- Créneaux calculés à la volée (`practitioner_free_slots` : horaires − congés − fermetures − rendez-vous actifs − absence − passé), jamais stockés. Chevauchements exclus par la base (`appointments_no_overlap`).
- Écritures uniquement par RPC (`book_appointment`, `reschedule_appointment`, `cancel_appointment`, `check_in_appointment`, `mark_appointment_no_show`). Nom du patient (`customer_label`, + `customer_age` / `customer_file_number`) : mêmes règles que le nom du client ci-dessous.
- Règle d'équité : `pickNextTicket` (`@nextin/shared/appointments`) et `public.fair_pick` doivent rester identiques (`fairness.fixtures.json`, recopié dans `m5b_appointments.test.sql` et vérifié par Vitest).
- Messages de rendez-vous : contacts et jobs rattachés au rendez-vous (`ticket_id` nul) ; à l'arrivée, le numéro est recopié sur le ticket.
- **Responsive obligatoire** pour tout nouvel écran : téléphone (360 px+), tablette portrait et paysage, ordinateur (1440 et 1920 px) avec une vraie mise en page (maître-détail, grilles, `useMediaQuery`). Captures dans les cinq tailles (390, 820, 1180, 1440, 1920), critères de `docs/REVUE-RESPONSIVE.md` §4 vérifiés par `e2e/responsive.spec.ts` (ajouter chaque nouvel écran à sa liste).

## Écran TV (M6, `docs/modules/M6.md`)
- `/tv` sans compte : code à 6 chiffres → `pair_display` (back-office « Écrans ») → jeton d'appareil (seule l'empreinte en base, jamais lisible) ; `GET /api/tv/session` chaque minute, 401 = retour à l'appairage.
- Affichage par le canal public `boardTopic` filtré sur les services de l'écran ; aucun nom.
- `branch_board.calls` = appels du jour, en cours **et** terminés depuis moins de 30 min (12 au plus) : filtrer avec `isActiveCall` pour « appels en cours ». S'abonner au tableau avec `subscribeBoard` (`lib/client/board-feed.ts`), jamais une relecture brute qui écraserait une diffusion plus récente.
- Annonces : `@nextin/shared/announcements` (segments `fr/word-ticket`, `fr/letter-c`, `fr/47`… + texte de repli) ; voix MP3 dans le bucket public `voices` (`pnpm voices:generate`, ElevenLabs) avec `manifest.json`, sinon synthèse vocale du navigateur ; carillon synthétisé ; « Activer le son » obligatoire.
- `data-theme="light"` possible sur un sous-arbre (écran TV, ticket imprimé). Choix multiples : `ListSection checkboxGroupLabel`.

## Notifications (M7, `docs/modules/M7.md`)
- Mise en file **uniquement par la base** : déclencheurs sur `ticket_events` (appel, rappel, recul, réorientation + « bientôt votre tour » selon `almost_turn_threshold`), `practitioner_absences` (retard) et `notification_contacts` (confirmation). Un job par contact actif, `dedupe_key` unique.
- Expéditeur `dispatchNotifications` (`lib/notifications/dispatcher.ts`) : `claim_notification_jobs` (SKIP LOCKED) → `sendJob` (`send.ts`, pur, testé) → `complete_notification_job`. Réveillé par pg_net (`kick_notification_dispatch`, adresse + secret dans Vault via `pnpm notify:configure`) et pg_cron chaque minute ; en dev / e2e, l'application interroge la file (`instrumentation.ts`, `NOTIFY_POLL=1`).
- Textes FR/EN et modèles Meta : `@nextin/shared/notifications` (`WHATSAPP_TEMPLATES` = texte exact soumis à Meta ; même texte en message libre dans la fenêtre de 24 h). Ne jamais modifier un texte de modèle sans le refaire approuver.
- WhatsApp : opt-in initié par le client (« NEXTIN C-047 7K3Q », `optInLink`), webhook `/api/whatsapp/webhook` signé (`X-Hub-Signature-256`, `WHATSAPP_APP_SECRET`), idempotent (`record_webhook_event`) ; STOP global haché (`whatsapp_opt_outs`). Fournisseur réel si `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`, faux sinon (numéro en `99999` = échec simulé).
- Bascule : WhatsApp en échec définitif → SMS immédiat ; « c'est votre tour » non remis en 2 min → SMS (délai de garde). Web push en complément (`/api/notifications/push`, VAPID). Les e2e forcent les faux fournisseurs (`playwright.config.ts`).
- Valeurs `NEXT_PUBLIC_*` lues à l'exécution côté serveur avec un accès calculé (`process.env[name]`), sinon figées au build.

## Tableau de bord (M8, `docs/modules/M8.md`)
- Vue d'ensemble `/app/o/[orgId]` = tableau de bord (administrateurs : tout l'établissement ; responsables : leurs agences) ; période par défaut « 30 derniers jours » glissants (`last30`), jour / semaine / mois au choix ; courbe remplacée par un état vide sous 7 jours renseignés (`hasEnoughPoints`) ; étapes de démarrage dans `/setup`. Droits vérifiés en base (`assert_stats_access`).
- Statistiques anonymes uniquement : cumuls `daily_branch_stats` / `daily_counter_stats` (pg_cron nocturne, idempotent) + jour en cours et veille non cumulée calculés en direct (`stats_branch_rows`). Ne jamais lire `tickets` directement pour un indicateur : passer par `compute_*_stats`.
- Périodes, comparaisons, écarts et CSV : `@nextin/shared/stats` (pur, testé). Graphiques faits maison, sans bibliothèque : `bar-chart.tsx` (une série, pic en orange) et `line-chart.tsx` (attente moyenne par jour, période précédente en pointillés via `daily_wait_series`), infobulle et tableau pour lecteurs d'écran. Indicateurs : évolution en badge (vert = mieux, orange = moins bien, gris = stable).

## Distance (M9, `docs/modules/M9.md`)
- Pages client : `/nearby` (onglet « À proximité », liste + carte), `/b/[branchId]` (agence, ticket à distance), `/b/[branchId]/rdv` (demande de rendez-vous), `/r/[token]` (code WhatsApp puis réponse). Même budget < 200 Ko (testé) : pas de préchargement des pages d'agence depuis la liste, détail des services seulement dans `branch_public`.
- Position du client : `lib/client/geolocation.ts`, demandée seulement quand elle sert, **jamais enregistrée** (seul `tickets.remote_travel_seconds`). « Quand partir » : `leaveAdvice` (`@nextin/shared/remote`) ; `travelSeconds` identique à `public.remote_travel_seconds`.
- Carte maison sans bibliothèque (`components/client/nearby-map.tsx`) ; tuiles seulement via `NEXT_PUBLIC_MAP_TILES_URL` (fournisseur sous contrat), sinon plan schématique.
- Ticket à distance non confirmé : jamais appelé ; recul ou annulation dans `pick_next_ticket` (un autre patient doit attendre). Présence : `confirm_presence` (QR ou code court de l'agence, automatique en ouvrant `/q/<code>` avec un ticket à distance enregistré sur l'appareil) ou `staff_confirm_presence`.
- Demandes de rendez-vous : `create_appointment_request` (serveur uniquement) → code 6 chiffres (empreinte en base, code effacé de la file après vérification) → `pending` visible de l'accueil → `accept_appointment_request` (créneau demandé = « accepted », autre = « modified ») ou `decline_appointment_request`. Réponse WhatsApp par les événements `request_*` ; modèle `code_verification` en catégorie Authentification (bouton « Copier le code »).
- Options d'agence désactivées par défaut : `remote_tickets_enabled`, `appointment_requests_enabled` ; `public_listing_enabled` activée.

## Abonnements (M10a, `docs/modules/M10a.md`)
- Inscription : `/app/new` en trois étapes (téléphone → code WhatsApp → établissement) puis `self_service_signup` (essai sur la formule `trial_eligible`, Business, **un seul par numéro**). `create_organization` n'est plus appelable par les comptes ; les tests passent par `signUpOrganization` / `verifyPhoneViaUi`. Sans abonnement = établissement « pilote » (tout compris).
- Droits : `org_entitlements(org)` (base, service role) / `staff_entitlements(org)` (personnel). Limites par déclencheurs (`plan_limit`), fonctions par `assert_feature` (`feature_unavailable`), émission bloquée en lecture seule (`subscription_read_only`). Ne jamais tester une limite côté client seulement.
- Prix : `computeSubscriptionPrice` (`@nextin/shared/billing`) ≡ `public.subscription_price` (`pricing.fixtures.json`, recopié dans `m10a_billing.test.sql`) ; `targetStatus` ≡ `subscription_target_status`.
- Dégradations seulement par `apply_pending_transitions` (après la fermeture de toutes les agences) ; réactivation immédiate par `confirm_payment` (idempotent). Factures `invoices` immuables (déclencheur), numérotées sans trou, PDF rendu à la demande (`lib/pdf/invoice.tsx`) depuis l'instantané.
- Paiement : `/pay/<jeton>` (page légère < 200 Ko, `useLiteT`) → `POST /api/payments` → `PaymentProvider.createCheckout` ; état par `POST /api/payments/status` ; webhook `/api/payments/webhook/<fournisseur>` signé, enregistré (`record_webhook_event`) puis **revérifié par `fetchStatus`** avant activation. Faux fournisseur : `PAYMENT_PROVIDER=fake`, `PAYMENT_WEBHOOK_SECRET` requis, numéro en `99999` = échec.
- Messages du compte : file `account_messages` (base) → expéditeur M7 (`lib/notifications/account.ts`) ; modèles `ACCOUNT_TEMPLATES` (`@nextin/shared/billing`), mêmes règles que les modèles Meta du M7. Quota WhatsApp : `quota_exceeded` dans `claim_notification_jobs` (« c'est votre tour » toujours envoyé).
- Back-office : bandeau `BillingBanner` et `SuspendedGate` dans le gabarit de l'établissement ; page `/app/o/<org>/billing` (administrateurs). Console super admin `/admin` (abonnements, formules, réglages) ; toute action avec motif, journalisée par la base.

## Grille tarifaire v2 (`docs/modules/TARIFS-V2.md`)
- Formules Starter / Business / Premium / Enterprise (sur devis : `quote_only`, « Nous contacter », pas de paiement en ligne, refus `plan_quote_only`) ; valeurs initiales dans `20261114090000_pricing_v2.sql`, toutes modifiables par le super admin. Essai sur la formule `trial_eligible` (Business). Établissements pilotes = Enterprise sans limite. Les anciennes lignes Essentiel/Pro/Entreprise ont été renommées (même identifiant, échéances et factures inchangées).
- Limites **par établissement** (`ENTITLEMENT_LIMITS`, null = illimité) : agences, services, guichets, écrans, utilisateurs (comptes actifs + invitations en attente), tickets par mois, messages WhatsApp par mois, historique (mois). Vérifiées par `enforce_plan_limits` (seul l'ajout est refusé, `plan_limit`). Limites sur mesure : `subscriptions.limit_overrides` via `admin_set_limits` (motif, journalisé).
- Quotas du mois (`quota_status`, table `messaging_usage` : `tickets_created`, `*_reached_on`, `alerts`) : un ticket créé = 1 unité (pas les réorientations, jamais un changement de statut). **Jamais de blocage le jour où la limite est atteinte** : la file continue jusqu'à la fermeture ; refus `monthly_quota_reached` seulement à partir du lendemain (`quota_item.blocked`). Même règle pour WhatsApp (« c'est votre tour » toujours envoyé). Alertes au directeur à `quota_alert_percent` (80 %) et 100 %, une fois par mois et par seuil. Côté écran : `quotaState` (`@nextin/shared/billing`) ≡ `quota_item`, `QuotaBanner` (back-office) et `QuotaPanel` (Abonnement).
- Extensions de quota (`quota_packs`, prix et quantités par le super admin) : `extension_checkout` → facture `kind = 'extension'` → `/pay` → `confirm_payment` → `quota_extensions` du mois en cours (blocage levé si la nouvelle limite le permet).
- Historique : `stats_branch_rows` / `stats_counter_rows` masquent les jours avant `stats_history_start(org)` (≡ `historyStart`), sans rien supprimer ; note dans le tableau de bord.
- **Pages client (/q, /b, /rdv)** : `online_open` (et `requests_open` sur /b) dans `resolve_entry`, `branch_public`, `request_options` (`online_tickets_open`, `online_requests_open` : lecture seule, suspension, quota de tickets bloquant, fonction de la formule). Fermé : encadré neutre `common.onlineUnavailable` dès l'ouverture, services sans temps d'attente, bouton désactivé. **Jamais** la raison (abonnement, paiement, quota) côté client : codes de refus correspondants ramenés au même encadré (`isOnlineUnavailable`). Test : `online_availability.test.sql`, `e2e/online-availability.spec.ts`.

## Absent automatique (`docs/modules/ABSENCE-AUTO.md`)
- Tâche `sweep_missed_calls` (pg_cron, 30 s) → `handle_missed_call` : ticket `called` non admis dans `no_show_grace_seconds` (défaut 180 s, depuis le dernier appel ou rappel) → 1er manqué : `waiting`, recul `no_show_move_back_places` (3) par `shift_ticket_back`, événement `missed_call` ; 2e : `no_show` (payload `auto`). Puis le poste appelle le suivant s'il est ouvert, libre et non verrouillé par l'agent (`SKIP LOCKED`, jamais d'attente).
- Rien avant l'appel ; tickets à distance exclus (règles M9). Réglages dans « Réglages de la file » (`auto_no_show_enabled`). `tickets.missed_calls` → `ticket_view`, carte « Vous avez été appelé » sur « Mon ticket ».
- Messages `missed_call` / `missed_call_cancelled` (modèles `appel_manque`, `ticket_annule_appels_manques`) ; clé « c'est votre tour » suffixée `:m<n>` après un appel manqué.

## Demandes en ligne par e-mail (`docs/modules/RDV-EMAIL.md`)
- Canaux des demandes : `platform_settings.request_channels` (console Wintek → Réglages ; e-mail seul par défaut, WhatsApp et SMS prévus ; plusieurs = choix du patient). `create_appointment_request(…, p_email, p_channel)` refuse un canal non activé (`channel_unavailable`) ; e-mail : adresse exigée, téléphone facultatif **pour l'accueil seulement** (jamais de contact WhatsApp créé pour lui, même au déplacement).
- Contact de vérification = canal de la demande (`notification_contacts.channel = 'email'`, colonne `email`) ; `issue_request_code`, refus, réponse et rappels partent sur les contacts de la demande, recopiés sur le rendez-vous à l'acceptation (push compris : `register_request_push_contact`, route `/api/notifications/push` avec `target: "request"`). Doublons et limites par `requester_key` (adresse, sinon numéro).
- Adresse : personnel de l'agence seulement (`request_staff_json`, `appointment_json`), masquée côté patient (`mask_email`), purgée par `purge_personal_data`. Liens des messages d'un rendez-vous issu d'une demande : `/r/<jeton>` (`appointment_notification_view.request_token`).
- Envoi : `EMAIL_PROVIDER=smtp` + `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` (Brevo ou Resend, `lib/notifications/providers/email.ts`, nodemailer chargé à la demande) ; `console` sinon (texte affiché en local). Contenu : `notificationEmail` (`@nextin/shared/notifications`), texte + HTML, FR/EN.

## Publicité (M10b, `docs/modules/M10b.md`)
- Formules `ad_packages` (Maison, Bronze, Argent, Or) et secteurs `ad_sectors` modifiables par le super admin : aucun prix, part de diffusion ni surface en dur. Visa santé exigé à la soumission **et** à la validation pour les secteurs `requires_health_visa` (sauf annonces Maison).
- Écritures uniquement par RPC (`save_campaign`, `save_creative`, `save_quiz`, `save_game_skin`, `submit_campaign`, `review_campaign`, `campaign_checkout`, `set_ad_preferences`, `redeem_coupon`…). Paiement des campagnes : facture `invoices.kind = 'campaign'` puis `/pay/<jeton>` et `confirm_payment` (même agrégateur que le M10a).
- Diffusion calculée par la base (`ad_candidates`, `ad_weighted_draw`) ; côté appareil, `nextAd` (`@nextin/shared/ads`) suit la même règle. Les annonces Maison comblent la part non vendue. Secteurs refusés par établissement appliqués par la base.
- Fichiers : `ad-creatives` (public) et `ad-documents` (privé), chemin `<annonceur | org-<établissement>>/<campagne>/<fichier>` ; poids vérifié par la base (`ad_file_size`). Application et jeux : images seulement.
- Événements (affichage, clic, « Passer ») : file de l'appareil (`lib/client/ad-events.ts`) → `POST /api/ads/events` → `record_ticket_ad_events` / `record_display_ad_events` (agence déduite du jeton, idempotent, limité). Jamais d'identifiant client ; statistiques par `campaign_stats` (cumuls horaires).
- « Mon ticket » : carte de jeu et pub montées par `LazyMount` (après le chargement), feuille de jeu `next/dynamic` avec ses textes de `/api/i18n/games` ; la feuille garde le numéro et l'attente en tête et se fige à l'appel. Ne rien ajouter au premier chargement de `/t` sans remesurer le budget (≈ 198 Ko).
- Sky Catch : logique pure `@nextin/shared/ads/sky-catch` (testée), rendu canvas dans `components/client/games/sky-catch.tsx`, couleurs par jetons `--game-*`. Bons : `/coupon/<jeton>` (QR via `QrImage`), validation `/ads/redeem`.
- Tests e2e de diffusion : agence dans une ville propre et campagne Or ciblant cette ville (`e2e/ads-helpers.ts`), la base locale contenant d'autres campagnes.

## Backlog n° 1 (`docs/modules/BACKLOG-1.md`)
- Gabarits à barre latérale : `SidebarShell` + `SidebarPanel` (`components/shell`) ; fixe à partir de 1024 px, repliable sur tablette portrait (bouton dans la barre de navigation, Échap, fermeture en naviguant), absente sur téléphone (navigation par listes). Retour masqué sur ordinateur si la rubrique est dans la barre latérale (`isSidebarDestination`, `back.inSidebar`). Toute grille responsive part de `grid-cols-1`.
- `NavigationBar` : sur ordinateur, les actions `trailing` s'alignent sur le grand titre (ne pas les repositionner écran par écran).
- Poste : raccourcis `deskShortcut` / `shortcutTargetAllowed` (`@nextin/shared/desk`, mêmes règles que les boutons), mode compact `useDeskCompact` (`lib/desk/compact.ts`).
- Présence à distance : code tournant de l'écran TV (`presence_code`, `presence_url`), réglage `remote_presence_tv_only` ; secret par agence jamais lisible (`branch_presence_secrets`).
- Publicité : agences choisies (`set_campaign_branches`, plafond de la formule), rôle `cashier` (`/ads/redeem` seulement) ; scanner partagé `useQrCamera` (`lib/client/qr-camera.ts`). `ListRow disabled` pour une ligne non cochable. Icône de secteur : `OrgTypeIcon` (`components/ui`).

## Nom du client (`docs/modules/NOM-CLIENT.md`)
- Réglage par agence (`branch_settings.customer_name_mode` = `off` / `optional` / `required`, `customer_name_extra` = `none` / `age` / `file_number`) ; défaut : obligatoire pour `clinic` / `hospital`, non demandé ailleurs (déclencheur). Règles publiques : `customer_identity_rules(branch)`.
- Tickets : table à part `ticket_identities` (lecture : personnel de l'agence seulement, ni clients ni console Wintek ; écriture par RPC). `take_ticket` / `take_remote_ticket` / `create_appointment_request` exigent le nom si l'agence le demande (`name_required`) ; l'accueil peut le compléter ensuite (`set_ticket_identity`). L'identité suit la réorientation et l'arrivée d'un rendez-vous ; purgée par `purge_personal_data()`.
- Validation identique côté navigateur : `parseIdentity` (`@nextin/shared/identity`). Pages client : `CustomerIdentityFields` + `useIdentityValue` (mémorisé sur l'appareil, lecture via `useSyncExternalStore`).
- Postes : nom sous le numéro et dans « À suivre », « Masquer le nom » et masquage après 2 min sans activité (`useNameMask`). Changement de nom → événement `identity` sur `staffTopic` (sans le nom).
- Actions secondaires d'un ticket (priorité, nom) : feuille du ticket sélectionné (accueil) ou menu « … » de la ligne (poste, `TicketMenu`) — jamais un bouton par ligne.

## Revue responsive (`docs/REVUE-RESPONSIVE.md`, notes `docs/modules/RESPONSIVE.md`)
- Retour de la barre de navigation : libellé entier ou chevron seul (libellé gardé pour les lecteurs d'écran), jamais coupé. Sous-titres de `ListRow` : deux lignes au plus. `SegmentedControl` : une ligne. Rangées de pastilles : `scroll-fade-x`.
- Détail d'une vue maître-détail : `@container` sur le panneau ; mises en page en colonnes par requêtes de conteneur (`@2xl:grid-cols-2`).
- Pages client ≥ 1024 px : `ClientTabBar` en barre latérale (`TabBar sidebar`, contenu décalé par `body:has([data-tab-sidebar])`) ; onglets et retours sans préchargement (`prefetch={false}`, budget). Pages sans onglets sur téléphone (choix du service, ticket, code) : `DesktopClientSidebar` (chargé à partir de 1024 px). Formulaires client courts : colonne ≈ 640 px (`lg:max-w-[40rem]`), action juste sous le contenu.
- Formulaire qui ne contient que sa `BottomBar` : `className="contents"` (sinon la barre ne peut pas coller au bas du contenu). Feuilles et alertes : `NoPageFrame` (leur barre ne remonte jamais dans la barre de titre).
- Écran TV : tailles et espacements en `vh`/`vw`, interligne sans unité (`leading-snug` sur la racine) — vérifié en 720p, 1080p et 4K.
- Données de test : `pnpm e2e:cleanup` (comptes `@nextin.test`, établissements et annonceurs de test), lancé aussi à la fin de Playwright en local ; `-- --remote` pour le projet distant lié.
- Captures : base propre (`pnpm db:reset` puis `pnpm seed:demo:local`), `RESPONSIVE_PHASE=before|before-p2|after` et `RESPONSIVE_ONLY=<préfixes>` avec `e2e/screenshots-responsive.spec.ts`.

## i18n
- Dictionnaires typés `packages/shared/src/i18n/{fr,en}.ts` ; `fr` est la source, `en` doit avoir exactement les mêmes clés et variables (test Vitest).
- Langue sans préfixe d'URL : cookie `NEXTIN_LOCALE`, sinon `Accept-Language`, sinon `fr`. Fuseau `Africa/Douala`. Monnaie XAF entière (`formatXaf`). Téléphones E.164 +237 (`normalizeCameroonPhone`).
- Ne transmettre au client que les espaces de noms nécessaires (`NextIntlClientProvider messages={…}`).

## Tests exigés à chaque module
Vitest (logique), pgTAP (RLS / RPC), Playwright (parcours du module, axe, cibles tactiles), captures dans `docs/captures/<module>/`, données de démo à jour, note `docs/modules/<module>.md`.
