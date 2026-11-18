import { House, MapPin, Ticket, UserRound } from "lucide-react";
import { LogoImage } from "@/components/ui/logo-image";
import { TabBar } from "@/components/ui/tab-bar";

export type ClientTab = "home" | "nearby" | "tickets" | "profile";
export type ClientTabLabels = Record<"label" | ClientTab, string>;

/**
 * Onglets du client (maquette v2 01) : Accueil, À proximité, Tickets, Profil — barre native iOS sur téléphone,
 * barre latérale sur ordinateur. Rendue par le serveur (aucun JavaScript), textes passés par `ClientTabs`.
 * `mobile={false}` : pages d'un parcours (choix du service, code, agence) sans onglets sur téléphone.
 */
export function ClientTabBar({
  active,
  labels,
  mobile = true,
  className,
}: {
  active: ClientTab | null;
  labels: ClientTabLabels;
  mobile?: boolean;
  className?: string;
}) {
  return (
    <TabBar
      label={labels.label}
      active={active ?? ""}
      className={className}
      mobile={mobile}
      prefetch={false}
      sidebar={<LogoImage className="h-11" />}
      items={[
        { key: "home", label: labels.home, icon: <House aria-hidden />, href: "/" },
        { key: "nearby", label: labels.nearby, icon: <MapPin aria-hidden />, href: "/nearby" },
        { key: "tickets", label: labels.tickets, icon: <Ticket aria-hidden />, href: "/t" },
        { key: "profile", label: labels.profile, icon: <UserRound aria-hidden />, href: "/profile" },
      ]}
    />
  );
}
