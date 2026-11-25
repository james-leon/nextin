"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";

export type InvoiceItem = { id: string; number: string; subtitle: string; status: string; href: string };

/** Ligne « Factures › » du détail d'une campagne : la liste s'ouvre dans une feuille, chaque facture en PDF. */
export function InvoicesRow({ invoices }: { invoices: InvoiceItem[] }) {
  const t = useTranslations("ads");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListSection>
        <ListRow
          onClick={() => setOpen(true)}
          icon={
            <ListIcon color="var(--icon-gray)">
              <FileText />
            </ListIcon>
          }
          title={t("invoices")}
          detail={<span className="tabular">{invoices.length}</span>}
          accessory="chevron"
        />
      </ListSection>
      <Sheet open={open} onOpenChange={setOpen} title={t("invoices")} closeLabel={tc("close")}>
        <ListSection footer={invoices.length ? undefined : t("invoicesEmpty")}>
          {invoices.map((i) => (
            <ListRow key={i.id} href={i.href} download title={<span className="tabular">{i.number}</span>} subtitle={i.subtitle} detail={i.status} />
          ))}
        </ListSection>
      </Sheet>
    </>
  );
}
