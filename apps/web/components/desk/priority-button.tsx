"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Accessibility, Baby, PersonStanding } from "lucide-react";
import type { PriorityReason } from "@nextin/shared/queue/live";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";

/** Motifs proposés au personnel en un geste (le rendez-vous est donné à l'arrivée du patient). */
const QUICK_REASONS = [
  { reason: "pregnancy", icon: Baby },
  { reason: "elderly", icon: PersonStanding },
  { reason: "disability", icon: Accessibility },
] as const satisfies readonly { reason: PriorityReason; icon: unknown }[];

/**
 * Bouton « Prioritaire » d'un ticket en attente (accueil et poste) : un geste ouvre le choix du motif
 * (Grossesse, Personne âgée, Handicap), puis `onGrant` appelle `set_ticket_priority` (journalisé par la base).
 * Seul le personnel accorde la priorité : le client ne peut plus la demander.
 */
export function PriorityButton({
  code,
  onGrant,
  disabled,
}: {
  code: string;
  onGrant: (reason: PriorityReason) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("reception");
  const tr = useTranslations("priorityReasons");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="tinted" size="md" disabled={disabled} aria-label={t("priorityQuickLabel", { code })} onClick={() => setOpen(true)}>
        {t("priorityQuick")}
      </Button>
      {open ? (
        <Sheet open onOpenChange={setOpen} title={t("priorityReasonsTitle", { code })} closeLabel={tc("close")}>
          <ListSection footer={t("priorityFooter")}>
            {QUICK_REASONS.map(({ reason, icon: Icon }) => (
              <ListRow
                key={reason}
                onClick={() => {
                  setOpen(false);
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
      ) : null}
    </>
  );
}
