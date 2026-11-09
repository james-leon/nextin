"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet } from "@/components/ui/sheet";

export type BranchService = { id: string; name: string; prefix: string; color: string };

/** Réorientation d'un ticket vers un autre service de l'agence (priorité et ancienneté conservées). */
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
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${t("transferTitle")} · ${code}`}
      description={t("transferBody")}
      closeLabel={tc("close")}
      footer={
        <Button
          block
          disabled={!target}
          onClick={() => {
            onConfirm(target!);
            onOpenChange(false);
          }}
        >
          {t("transferConfirm")}
        </Button>
      }
    >
      {services.length === 0 ? (
        <p className="px-1 py-4 text-body text-label-secondary">{t("noOtherService")}</p>
      ) : (
        <ListSection radioGroupLabel={t("transferTitle")}>
          {services.map((s) => (
            <ListRow
              key={s.id}
              role="radio"
              selected={target === s.id}
              onClick={() => setTarget(s.id)}
              icon={<ServiceTile letter={s.prefix} color={s.color} />}
              title={s.name}
              accessory="check"
            />
          ))}
        </ListSection>
      )}
    </Sheet>
  );
}
