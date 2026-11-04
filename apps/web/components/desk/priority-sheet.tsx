"use client";

import { useTranslations } from "next-intl";
import { Accessibility, Baby, PersonStanding } from "lucide-react";
import type { PriorityReason } from "@nextin/shared/queue/live";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";

/** Motifs proposés au personnel (le rendez-vous est donné à l'arrivée du patient). */
const QUICK_REASONS = [
  { reason: "pregnancy", icon: Baby },
  { reason: "elderly", icon: PersonStanding },
  { reason: "disability", icon: Accessibility },
] as const satisfies readonly { reason: PriorityReason; icon: unknown }[];

/**
 * Choix du motif de priorité d'un ticket en attente (Grossesse, Personne âgée, Handicap), ouvert depuis le ticket
 * sélectionné (accueil) ou le menu « … » de la ligne (poste) ; `onGrant` appelle `set_ticket_priority`
 * (journalisé). Seul le personnel accorde la priorité.
 */
export function PrioritySheet({
  code,
  open,
  onOpenChange,
  onGrant,
}: {
  code: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGrant: (reason: PriorityReason) => void;
}) {
  const t = useTranslations("reception");
  const tr = useTranslations("priorityReasons");
  const tc = useTranslations("common");
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("priorityReasonsTitle", { code })} closeLabel={tc("close")}>
      <ListSection footer={t("priorityFooter")}>
        {QUICK_REASONS.map(({ reason, icon: Icon }) => (
          <ListRow
            key={reason}
            onClick={() => {
              onOpenChange(false);
              onGrant(reason);
            }}
            icon={
              <ListIcon color="var(--orange-fill)">
                <Icon />
              </ListIcon>
            }
            title={tr(reason)}
          />
        ))}
      </ListSection>
    </Sheet>
  );
}
