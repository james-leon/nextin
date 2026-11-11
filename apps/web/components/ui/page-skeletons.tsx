import { Skeleton } from "./skeleton";

/**
 * Squelettes fidèles des écrans (U1, `loading.tsx`) : mêmes conteneurs, marges et rayons que la page chargée,
 * pour qu'aucun bloc ne saute à l'arrivée du contenu. Rendus par le serveur, sans JavaScript. Le libellé
 * (« Chargement… ») est annoncé aux lecteurs d'écran ; l'animation suit `prefers-reduced-motion`.
 */
function Frame({ label, children, wide, inShell }: { label: string; children: React.ReactNode; wide?: boolean; inShell?: boolean }) {
  // Dans le gabarit à barre latérale (back-office), la région principale existe déjà : pas de second <main>.
  const Root = inShell ? "div" : "main";
  return (
    <Root className="min-h-dvh pb-28" aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div className={wide ? "mx-auto max-w-7xl px-4 pt-6 md:px-8 lg:px-10" : "mx-auto max-w-lg px-4 pt-6 lg:max-w-[40rem]"}>{children}</div>
    </Root>
  );
}

function Title() {
  return (
    <div className="flex flex-col gap-2 pb-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-56" />
    </div>
  );
}

/** « Mon ticket » : carte du ticket (numéro, deux indicateurs, progression), position, actions. */
export function TicketSkeleton({ label }: { label: string }) {
  // Peu d'éléments : la page du ticket est la plus proche du budget de 200 Ko.
  return (
    <Frame label={label}>
      <Title />
      <Skeleton className="h-80 rounded-[var(--radius-2xl)]" />
      <Skeleton className="mt-4 h-[3.125rem] rounded-[12px]" />
    </Frame>
  );
}

/** Liste de cartes ou de lignes (choix du service, agence, « À proximité »). */
export function ListSkeleton({ label, rows = 4, hero = false }: { label: string; rows?: number; hero?: boolean }) {
  return (
    <Frame label={label}>
      <Title />
      {hero ? <Skeleton className="mb-4 aspect-[16/9] rounded-[var(--radius-2xl)]" /> : null}
      <div className="squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-[12px]" />
        ))}
      </div>
      <Skeleton className="mt-5 h-[3.125rem] rounded-[12px]" />
    </Frame>
  );
}

/** Poste de l'agent : carte du patient en cours (bleu nuit), bouton principal, « À suivre ». */
export function DeskSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label} wide>
      <Title />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-[var(--radius-2xl)]" />
          <Skeleton className="h-[3.125rem] rounded-[12px]" />
        </div>
        <div className="squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-[10px]" />
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Accueil : colonnes services / file / rendez-vous (une seule colonne sur téléphone). */
export function ReceptionSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label} wide>
      <Title />
      <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, c) => (
          <div key={c} className="squircle flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-[10px]" />
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Back-office : grand titre, rangée d'indicateurs, deux panneaux. */
export function AdminSkeleton({ label }: { label: string }) {
  return (
    <Frame label={label} wide inShell>
      <Title />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-[var(--radius-xl)]" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
        <Skeleton className="h-64 rounded-[var(--radius-xl)]" />
      </div>
    </Frame>
  );
}
