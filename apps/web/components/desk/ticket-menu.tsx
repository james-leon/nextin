"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, PenLine, Star } from "lucide-react";
import type { DeskTicket } from "@nextin/shared/desk";
import type { IdentityRules } from "@nextin/shared/identity";
import type { PriorityReason } from "@nextin/shared/queue/live";
import { IconButton } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { IdentitySheet } from "./identity-sheet";
import { PrioritySheet } from "./priority-sheet";

/**
 * Menu « … » d'une ligne de la file (poste) : rendre prioritaire, saisir ou modifier le nom. Aucune action
 * secondaire n'est posée directement sur chaque ligne (une seule action principale visible par écran).
 */
export function TicketMenu({
  ticket,
  rules,
  canPrioritize,
  onGrantPriority,
  onIdentitySaved,
}: {
  ticket: Pick<DeskTicket, "id" | "code" | "priorityReason" | "identity">;
  rules: IdentityRules;
  canPrioritize: boolean;
  onGrantPriority: (reason: PriorityReason) => void;
  onIdentitySaved: () => void;
}) {
  const t = useTranslations("reception");
  const ti = useTranslations("identity");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const showPriority = canPrioritize && !ticket.priorityReason;
  const showIdentity = rules.mode !== "off";
  if (!showPriority && !showIdentity) return null;

  return (
    <>
      <IconButton label={t("ticketMenu", { code: ticket.code })} icon={<MoreHorizontal />} variant="plain" onClick={() => setOpen(true)} />
      {open ? (
        <Sheet open onOpenChange={setOpen} title={t("ticketActions", { code: ticket.code })} closeLabel={tc("close")}>
          <ListSection>
            {showPriority ? (
              <ListRow
                onClick={() => {
                  setOpen(false);
                  setPriorityOpen(true);
                }}
                icon={<ListIcon color="var(--orange-fill)"><Star /></ListIcon>}
                title={t("setPriority")}
                accessory="chevron"
              />
            ) : null}
            {showIdentity ? (
              <ListRow
                onClick={() => {
                  setOpen(false);
                  setIdentityOpen(true);
                }}
                icon={<ListIcon color="var(--accent-fill)"><PenLine /></ListIcon>}
                title={ticket.identity?.name ? ti("edit") : ti("enter")}
                accessory="chevron"
              />
            ) : null}
          </ListSection>
        </Sheet>
      ) : null}
      {priorityOpen ? <PrioritySheet code={ticket.code} open onOpenChange={setPriorityOpen} onGrant={onGrantPriority} /> : null}
      {identityOpen ? (
        <IdentitySheet
          open
          onOpenChange={setIdentityOpen}
          ticketId={ticket.id}
          code={ticket.code}
          rules={rules}
          initial={ticket.identity}
          onSaved={onIdentitySaved}
        />
      ) : null}
    </>
  );
}
