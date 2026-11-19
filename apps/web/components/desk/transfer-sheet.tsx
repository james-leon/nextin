"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet } from "@/components/ui/sheet";

/** Service de l'agence ; `waiting` = nombre de personnes dans sa file, quand le poste le connaît. */
export type BranchService = { id: string; name: string; prefix: string; color: string; waiting?: number };

/**
 * Réorientation d'un ticket vers un autre service de l'agence (maquette v2 20) : les autres services avec leur file,
 * puis un bouton qui dit exactement ce qui va se passer (« Transférer C-051 vers Laboratoire »). Le patient garde
 * sa priorité et son ancienneté.
 */
export function TransferSheet({
  code,
  services,
  open,
  onOpenChange,
  onConfirm,
}: {
  code: string;
  services: BranchService[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (serviceId: string) => void;
}) {
  const t = useTranslations("desk");
  const tc = useTranslations("common");
  const [target, setTarget] = useState<string | null>(null);
  const chosen = services.find((s) => s.id === target);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("transferTitle")}
      description={`${code} · ${t("transferBody")}`}
      closeLabel={tc("close")}
      cancelLabel={tc("cancel")}
      footer={
        services.length ? (
          <Button
            block
            disabled={!chosen}
            onClick={() => {
              onConfirm(chosen!.id);
              onOpenChange(false);
            }}
          >
            {chosen ? t("transferConfirmTo", { code, service: chosen.name }) : t("transferConfirm")}
          </Button>
        ) : null
      }
    >
      {services.length === 0 ? (
        <p className="px-1 py-4 text-body text-label-secondary">{t("noOtherService")}</p>
      ) : (
        <ListSection radioGroupLabel={t("transferTitle")} footer={t("transferBody")}>
          {services.map((s) => (
            <ListRow
              key={s.id}
              role="radio"
              selected={target === s.id}
              onClick={() => setTarget(s.id)}
              icon={<ServiceTile letter={s.prefix} color={s.color} />}
              title={s.name}
              subtitle={s.waiting === undefined ? undefined : <span className="tabular">{t("waitingCount", { count: s.waiting })}</span>}
              accessory="check"
            />
          ))}
        </ListSection>
      )}
    </Sheet>
  );
}
