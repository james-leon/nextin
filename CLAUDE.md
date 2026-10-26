# NextIn by Wintek — conventions du projet

Plateforme SaaS de files d'attente virtuelles (Cameroun) : PWA web d'abord, app Expo au M11.
Plan d'architecture validé : `docs/PLAN.md`. Notes de module : `docs/modules/`.

## Règles absolues
- **Aucun secret dans le code ni dans Git.** Variables listées dans `.env.example` (sans valeurs). Les fichiers `.env*` (sauf `.env.example`) et `supabase/.env` sont ignorés.
- **Jamais d'URL en dur** : toute URL absolue passe par `getAppUrl()` / `absoluteUrl()` (`@nextin/shared`), qui lisent `APP_URL`.
- **Un module à la fois** (M1 → M11), arrêt et validation à la fin de chaque module.
- **Migrations progressives** : un module ne crée que les tables dont il a besoin.
- Code complet uniquement, pas de TODO non signalé. Messages de commit clairs, en anglais, à l'impératif.
- Ne jamais annoncer, afficher sur TV ni envoyer le nom d'un client.

## Monorepo
- `apps/web` — Next.js 16 (App Router, Turbopack), Tailwind v4, composants maison façon shadcn (Radix + cva), next-intl.
- `packages/shared` — types (dont `src/types/database.ts` généré), schémas Zod, logique métier pure, i18n FR/EN.
- `supabase/` — `migrations/` (SQL horodaté `YYYYMMDDHHMMSS_mX_sujet.sql`), `tests/database/*.test.sql` (pgTAP).
- `scripts/` — `seed-demo.ts` (idempotent), `db-test.sh`.
- Identifiants (tables, colonnes, code) en **anglais** ; interface en **français** par défaut, anglais en bascule ; commentaires en français.

## Commandes
| | |
|---|---|
| `pnpm dev` / `pnpm build` | app web |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | ESLint, TypeScript, Vitest (tous les paquets) |
| `pnpm test:e2e` | Playwright (après `pnpm build`) — projets `mobile` et `desktop` |
| `pnpm --filter @nextin/web screenshots` | captures → `docs/captures/<module>/` |
| `pnpm db:start` · `pnpm db:reset` · `pnpm db:test` · `pnpm db:types` | Supabase local (Docker), tests pgTAP, types TS |
| `pnpm db:link` · `pnpm db:push` | lier et migrer le projet distant (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`) |
| `pnpm seed:demo` | DOUALA CLINIC + Eneo Douala (`SEED_DEMO_PASSWORD` requis) |
| `pnpm e2e:local` | build + Playwright contre le Supabase local |

En local, la CLI Supabase lit `SUPABASE_DB_PASSWORD` s'il est défini : les scripts `db:*` locaux le retirent (`env -u`).
Captcha : désactivé en local et en CI (Cloudflare injoignable depuis les conteneurs) ; activé en production dès que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` sont présentes (et dans Supabase Auth). Un `APP_URL` public sans clé est refusé.
Tests et dev **contre le Supabase local** : préfixer par `bash scripts/local-env.sh` (retire les variables du projet distant, qui priment sur `.env.local`) ; `pnpm e2e:local` fait build + Playwright.

## Base de données et sécurité
- RLS activée sur **toutes** les tables (vérifié par pgTAP). Isolation par `organization_id` présent sur chaque table métier.
- Fonctions d'autorisation `SECURITY DEFINER`, `set search_path = ''` : `is_platform_admin()`, `has_org_role(org, roles)`, `can_access_branch(org, branch, roles)`, `can_manage_member(org, branch, role)`.
- Écritures sensibles **uniquement via RPC** `SECURITY DEFINER` (pas de policy INSERT/UPDATE directe sur les tables critiques). `EXECUTE` révoqué par défaut sur les fonctions : accorder explicitement.
- Sessions anonymes (clients) : rôle `authenticated` + claim `is_anonymous` — toujours les exclure des droits du personnel (`public.is_anonymous()`).
- Journal d'audit append-only (`public.audit(...)`) pour toute action sensible. Rate limiting : `public.check_rate_limit(key, max, window)`.
- Redirections après connexion uniquement via `safeNextPath` (jamais de redirection ouverte). Server actions : Zod puis `ActionResult` avec des codes d'erreur du dictionnaire `errors`.
- Validation Zod côté client **et** serveur (schémas dans `@nextin/shared/schemas`). Turnstile vérifié côté serveur (`lib/security/turnstile.ts`).
- Données personnelles purgées après `organizations.data_retention_days` (défaut 30 j) — statistiques anonymisées uniquement.
- Chaque nouvelle table : RLS + policies + test pgTAP d'isolation entre deux organisations.
- **Abonnements (M10a, `docs/PLAN.md` §11)** : aucun prix, quota ni limite de formule en dur — tout vient de `plans` / `platform_settings` (modifiables par le super admin). Limites vérifiées côté serveur (`org_entitlements`). Aucune dégradation d'abonnement appliquée pendant les heures d'ouverture. Webhooks de paiement signés et idempotents. Factures jamais supprimées.

## Design — Apple Human Interface Guidelines (obligatoire)
Vitrine de référence : `/design` (`components/design/design-showcase.tsx`). Tokens : `apps/web/app/globals.css`.
- **Principes** : clarté, déférence au contenu, profondeur. **Une action principale par écran.** Beaucoup d'espace blanc, hiérarchie typographique forte.
- **Typo** système (`-apple-system`, SF Pro, Inter en repli), échelle iOS en `rem` (suit la taille de texte de l'utilisateur) : `text-large-title` 34, `text-title1` 28, `text-title2` 22, `text-title3` 20, `text-headline` 17 semibold, `text-body` 17, `text-callout` 16, `text-subheadline` 15, `text-footnote` 13, `text-caption` 12, `text-hero` pour le numéro de ticket. Chiffres : `tabular`.
- **Couleurs** : uniquement via tokens sémantiques (`bg-grouped`, `bg-grouped-secondary`, `text-label`, `text-label-secondary`, `bg-separator`, `bg-fill-*`…). Jamais de couleur en dur dans un composant.
- Accents Wintek **avec parcimonie** : Navy `#0D2C54` (marque), Blue `#1A6BB5` = **seule couleur d'action** (`bg-accent`, `text-accent-text`, `text-accent-on-tint` sur fond teinté), Orange `#F58B1F` (attention), Green `#2EC04E` (succès). Orange/Green en fond ou icône ; pour du texte, utiliser `text-orange-text` / `text-green-text` (AA).
- `text-label-tertiary` : icônes, chevrons, placeholders seulement — jamais pour du texte informatif (contraste).
- **Formes** : fond groupé `#F2F2F7`, cartes blanches, rayons continus 12–22 px (`rounded-[var(--radius-*)]` + `squircle`), séparateurs 0,5 px (`hairline-*`), ombres très douces (`shadow-card`).
- **Composants** (`components/ui`) : `Button` (filled/tinted/gray/plain/destructive/destructive-plain/navy, `leadingIcon`/`trailingIcon`), `IconButton` (label obligatoire), `ListSection`/`ListRow`/`ListSwitchRow`, `Card`, `StatCard`, `CalloutCard`, `Switch`, `SegmentedControl`, `TextField`/`SearchField`, `NavigationBar` (`large` avec sur-titre et grand titre réductible, ou `inline` ; retour en haut à gauche), `TabBar` (translucide, en bas sur mobile), `BottomBar` (action principale collée en bas), `Sheet` (vaul), `AlertDialog`, `Badge` (`pill` pour un statut, `tag` pour une étiquette)/`StatusDot`, `ProgressBar`, `Skeleton`, `Spinner`, `ToastProvider`, `TicketHero`, `NowServingCard`, `ServiceTile`, `ScannerFrame`, `Logo`/`LogoMark`. Réutiliser avant de créer.
- **Mouvement** : ressort CSS `ease-[var(--ease-spring)]`, 200–420 ms, jamais gratuit ; retour tactile immédiat (`pressable`) ; `prefers-reduced-motion` respecté.
- **Clair et sombre** sur chaque écran (`data-theme` sur `<html>`, préférence Auto/Clair/Sombre).
- **Accessibilité** : cibles ≥ 44 px (testé), contrastes AA (axe testé en clair et sombre), `aria-label` sur tout bouton icône, libellés associés aux champs, navigation clavier (`:focus-visible`), rôles ARIA corrects (ex. `ListSection radioGroupLabel` pour les choix exclusifs).
- **Icônes** : lucide au trait fin (style SF Symbols), `aria-hidden` si décoratives. **Jamais d'emoji.**
- **Client** : le numéro de ticket et l'attente estimée sont les héros visuels. Pages client < 200 Ko au premier chargement, utilisables en 3G : RSC, JS client minimal, pas de bibliothèque d'animation.
- **Maquette de référence** : `design/mockups/` (exports Claude Design) — à suivre fidèlement. 01 scanner (toujours sombre, `bg-scanner`), 02 choisir un service, 03 mon ticket, 04 agent/guichet, 05 écran TV (`bg-tv`), 06 tableau de bord, 07 chevalet A5, 08 affiche A4, 09 parcours. Les écrans 01 à 04 sont reconstruits dans `/design` (section « Écrans de la maquette ») : partir de ces compositions pour les vrais écrans.
- **Ticket** : format `C-047` (`formatTicketCode`), numéro en Navy (`text-ticket-number`, blanc en sombre), graisse extra-bold, jamais en chiffres tabulaires (le tiret s'élargirait). Couleurs de service : palette `SERVICE_COLORS` (pastille lettre, texte blanc).
- **Listes groupées** : séparateurs inset (`list-separator`) alignés sur le texte après la pastille, jamais sous la dernière ligne ; seul le `<li>` porte `group/row`.
- **Mon ticket** : « Recevoir mes alertes sur WhatsApp » (tinted, icône message) juste sous la carte du ticket ; actions du bas dans `TicketBottomActions` (BottomBar toujours visible) ; « Je suis en route » uniquement si `canSignalOnMyWay(source)` (ticket à distance).
- **Marque** : tuile bleue à flèche blanche + « NextIn » (`Logo`), aussi utilisée pour les icônes PWA.

## i18n
- Dictionnaires typés `packages/shared/src/i18n/{fr,en}.ts` ; `fr` est la source, `en` doit avoir exactement les mêmes clés et variables (test Vitest).
- Langue sans préfixe d'URL : cookie `NEXTIN_LOCALE`, sinon `Accept-Language`, sinon `fr`. Fuseau `Africa/Douala`. Monnaie XAF entière (`formatXaf`). Téléphones E.164 +237 (`normalizeCameroonPhone`).
- Ne transmettre au client que les espaces de noms nécessaires (`NextIntlClientProvider messages={…}`).

## Tests exigés à chaque module
Vitest (logique), pgTAP (RLS / RPC), Playwright (parcours du module, axe, cibles tactiles), captures dans `docs/captures/<module>/`, données de démo à jour, note `docs/modules/<module>.md`.
