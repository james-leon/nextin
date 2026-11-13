import { LogoMark } from "@/components/ui/logo";

/** En-tête des écrans de connexion : icône de l'application, grand titre et sous-titre, centrés. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <LogoMark className="mb-4 size-16" />
      <h1 className="text-large-title font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-body text-label-secondary">{subtitle}</p> : null}
    </header>
  );
}
