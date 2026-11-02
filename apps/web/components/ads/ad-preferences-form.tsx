"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Gamepad2, Megaphone, Plane } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import type { ActionResult } from "@/lib/auth/errors";
import type { SectorRow } from "@/lib/ads/types";
import { cn } from "@/lib/cn";

type Prefs = { blocked_sectors: string[]; quiz_enabled: boolean; sky_catch_enabled: boolean; house_ads_enabled: boolean };

/** Préférences publicitaires : secteurs refusés (choix multiples), jeux et annonces Maison (interrupteurs). */
export function AdPreferencesForm({
  sectors,
  prefs,
  action,
}: {
  sectors: SectorRow[];
  prefs: Prefs;
  action: (prev: ActionResult | null, data: FormData) => Promise<ActionResult>;
}) {
  const t = useTranslations("adPrefs");
  const ta = useTranslations("ads");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, null);
  const { top } = useFormErrors(state);
  const [blocked, setBlocked] = useState(prefs.blocked_sectors);
  const [quiz, setQuiz] = useState(prefs.quiz_enabled);
  const [sky, setSky] = useState(prefs.sky_catch_enabled);
  const [house, setHouse] = useState(prefs.house_ads_enabled);
  const sectorName = (s: SectorRow) => (locale === "en" ? s.name_en : s.name);
  const toggle = (code: string) => setBlocked((all) => (all.includes(code) ? all.filter((x) => x !== code) : [...all, code]));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <FormError message={top} />
      <ListSection header={t("games")}>
        <ListSwitchRow icon={<ListIcon color="var(--accent-fill)"><Gamepad2 /></ListIcon>} title={t("quiz")} subtitle={t("quizHint")} checked={quiz} onCheckedChange={setQuiz} />
        <ListSwitchRow icon={<ListIcon color="var(--brand-tile)"><Plane /></ListIcon>} title={t("skyCatch")} subtitle={t("skyCatchHint")} checked={sky} onCheckedChange={setSky} />
      </ListSection>
      <ListSection footer={t("tvNote")}>
        <ListSwitchRow icon={<ListIcon color="var(--orange-fill)"><Megaphone /></ListIcon>} title={t("house")} subtitle={t("houseHint")} checked={house} onCheckedChange={setHouse} />
      </ListSection>
      {/* Secteurs refusés : liste à cocher sur téléphone, grille de cases à partir de la tablette. */}
      <ListSection header={t("blocked")} footer={t("blockedHint")} checkboxGroupLabel={t("blocked")} className="md:hidden">
        {sectors.map((s) => {
          const checked = blocked.includes(s.code);
          return (
            <ListRow
              key={s.code}
              role="checkbox"
              selected={checked}
              onClick={() => toggle(s.code)}
              title={sectorName(s)}
              accessory="check"
            />
          );
        })}
      </ListSection>
      <section aria-labelledby="blocked-sectors" className="hidden flex-col gap-1.5 md:flex">
        <h2 id="blocked-sectors" className="px-4 text-footnote uppercase text-label-secondary">
          {t("blocked")}
        </h2>
        <div role="group" aria-labelledby="blocked-sectors" className="grid grid-cols-2 gap-2">
          {sectors.map((s) => {
            const checked = blocked.includes(s.code);
            return (
              <button
                key={s.code}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(s.code)}
                className={cn(
                  "pressable squircle flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] bg-grouped-secondary px-3 text-left text-body transition-colors",
                  checked ? "ring-2 ring-accent ring-inset" : "hover:bg-fill-tertiary/50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-[1.375rem] shrink-0 items-center justify-center rounded-full",
                    checked ? "bg-accent text-on-accent" : "border-[1.5px] border-label-tertiary",
                  )}
                >
                  {checked ? <Check className="size-3.5 stroke-[3]" /> : null}
                </span>
                <span className="min-w-0 flex-1">{sectorName(s)}</span>
              </button>
            );
          })}
        </div>
        <p className="px-4 text-footnote text-label-secondary">{t("blockedHint")}</p>
      </section>
      {blocked.map((code) => (
        <input key={code} type="hidden" name="blockedSectors" value={code} />
      ))}
      <input type="hidden" name="quizEnabled" value={String(quiz)} />
      <input type="hidden" name="skyCatchEnabled" value={String(sky)} />
      <input type="hidden" name="houseAdsEnabled" value={String(house)} />
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      </BottomBar>
    </form>
  );
}
