"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PRIORITY_REASONS, type PriorityReason } from "@nextin/shared/queue/live";
import { ListRow, ListSection } from "@/components/ui/list";
import { Sheet, SheetAction } from "@/components/ui/sheet";

/**
 * Motif de priorité d'un ticket en attente (maquette v2 20) : motif obligatoire choisi dans une liste, validé par
 * « OK » ; ouvert depuis le ticket sélectionné (accueil) ou le menu « … » de la ligne (poste). `onGrant` appelle
 * `set_ticket_priority` (journalisé). Seul le personnel accorde la priorité.
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
  const [reason, setReason] = useState<PriorityReason | null>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("priorityReasonsTitle", { code })}
      closeLabel={tc("close")}
      cancelLabel={tc("cancel")}
      action={
        <SheetAction
          disabled={!reason}
          onClick={() => {
            onOpenChange(false);
            onGrant(reason!);
          }}
        >
          {tc("done")}
        </SheetAction>
      }
    >
      <ListSection footer={t("priorityFooter")} radioGroupLabel={t("priorityReasonsTitle", { code })}>
        {PRIORITY_REASONS.map((r) => (
          <ListRow key={r} role="radio" selected={reason === r} onClick={() => setReason(r)} title={tr(r)} accessory="check" />
        ))}
      </ListSection>
    </Sheet>
  );
}
