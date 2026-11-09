"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { saveCampaignBranches } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { OrgTypeIcon } from "@/components/ui/org-type-icon";
import { Sheet } from "@/components/ui/sheet";

export type BranchOption = { id: string; name: string; city: string | null; organization: string; type: string; chosen: boolean };
export type BranchList = { branches: { name: string; city: string | null; organization: string }[]; others: number };

/**
 * Agences de diffusion d'une campagne d'annonceur. Formule plafonnée et campagne modifiable : choix (au plus le
 * plafond) dans une feuille, sinon tirage équitable à la validation. Ensuite : agences retenues, visibles avant le
 * paiement (agences publiques nommées, les autres comptées).
 */
export function BranchesSection({
  campaignId,
  max,
  options,
  list,
}: {
  campaignId: string;
  max: number | null;
  /** Campagne modifiable et formule plafonnée : agences proposées. */
  options: BranchOption[] | null;
  /** Campagne validée : agences retenues. */
  list: BranchList | null;
}) {
  const t = useTranslations("ads");
  const tc = useTranslations("common");
  const tt = useTranslations("orgTypes");
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(options?.filter((o) => o.chosen).map((o) => o.id) ?? []);
  const [state, action, pending] = useActionState(saveCampaignBranches.bind(null, campaignId), null);
  const { top } = useFormErrors(state);
  const label = (b: { organization: string; name: string; city: string | null }) => ({
    title: b.organization,
    subtitle: [b.name, b.city].filter(Boolean).join(" · "),
  });

  if (options && max != null) {
    const saved = options.filter((o) => o.chosen);
    return (
      <section aria-labelledby="branches-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-4">
          <h2 id="branches-title" className="text-title3 font-bold">
            {t("branches")}
          </h2>
          {options.length ? (
            <Button variant="gray" size="md" leadingIcon={<MapPin />} onClick={() => setOpen(true)}>
              {t("branchesChoose")}
            </Button>
          ) : null}
        </div>
        <ListSection header={t("branchesChosen", { count: saved.length })} footer={options.length ? t("branchesHint", { max }) : t("branchesEmpty")}>
          {saved.map((b) => (
            <ListRow key={b.id} icon={<ListIcon color="var(--brand-tile)"><OrgTypeIcon type={b.type} /></ListIcon>} {...label(b)} />
          ))}
        </ListSection>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title={t("branchesChoose")}
          description={t("branchesHint", { max })}
          closeLabel={tc("close")}
          footer={
            <Button type="submit" form="branches-form" block loading={pending} loadingLabel={t("saving")}>
              {t("save")} · {t("branchesLimit", { count: chosen.length, max })}
            </Button>
          }
        >
          <form id="branches-form" action={action} noValidate className="flex flex-col gap-4 pt-2">
            <FormError message={top} />
            <ListSection checkboxGroupLabel={t("branches")}>
              {options.map((b) => {
                const checked = chosen.includes(b.id);
                const full = !checked && chosen.length >= max;
                return (
                  <ListRow
                    key={b.id}
                    role="checkbox"
                    selected={checked}
                    disabled={full}
                    onClick={() => !full && setChosen((cur) => (checked ? cur.filter((x) => x !== b.id) : [...cur, b.id]))}
                    icon={<ListIcon color="var(--brand-tile)"><OrgTypeIcon type={b.type} /></ListIcon>}
                    title={b.organization}
                    subtitle={`${[b.name, b.city].filter(Boolean).join(" · ")} · ${tt(b.type as "clinic")}`}
                    accessory="check"
                  />
                );
              })}
            </ListSection>
            {chosen.map((id) => (
              <input key={id} type="hidden" name="branchIds" value={id} />
            ))}
          </form>
        </Sheet>
      </section>
    );
  }

  if (!list) return null;
  return (
    <section aria-labelledby="branches-title" className="flex flex-col gap-3">
      <h2 id="branches-title" className="px-4 text-title3 font-bold">
        {t("branches")}
      </h2>
      <ListSection footer={list.others ? t("branchesOthers", { count: list.others }) : list.branches.length ? undefined : t("branchesPending")}>
        {list.branches.map((b, i) => (
          <ListRow key={i} icon={<ListIcon color="var(--brand-tile)"><MapPin /></ListIcon>} {...label(b)} />
        ))}
      </ListSection>
    </section>
  );
}
