"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Gamepad2, Megaphone, Plane } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { AutoSaveStatus, useAutoSave } from "@/components/admin/use-auto-save";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import type { ActionResult } from "@/lib/auth/errors";
import type { SectorRow } from "@/lib/ads/types";
import { cn } from "@/lib/cn";

type Prefs = { blocked_sectors: string[]; quiz_enabled: boolean; sky_catch_enabled: boolean; house_ads_enabled: boolean };

/**
 * Publicité de l'établissement (maquette v2 24, P10), enregistrée automatiquement :
 * - `main` : secteurs refusés en pastilles (refusé = bleu nuit plein), jeux pendant l'attente (interrupteurs), puis la
 *   ligne « Annonces Maison › » (nombre d'annonces) ;
 * - `house` : l'interrupteur « Diffuser mes annonces Maison » de la liste des annonces Maison.
 * Les autres réglages partent tels quels en champs cachés (`set_ad_preferences` les reçoit tous).
 */
export function AdPreferencesForm({
  sectors,
  prefs,
  action,
  section = "main",
  house,
}: {
  sectors: SectorRow[];
  prefs: Prefs;
  action: (prev: ActionResult | null, data: FormData) => Promise<ActionResult>;
  section?: "main" | "house";
  /** Ligne « Annonces Maison » : lien et nombre d'annonces. */
  house?: { href: string; count: number };
}) {
  const t = useTranslations("adPrefs");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action);
  const { top } = useFormErrors(saveState.result);
  const [blocked, setBlocked] = useState(prefs.blocked_sectors);
  const [quiz, setQuiz] = useState(prefs.quiz_enabled);
  const [sky, setSky] = useState(prefs.sky_catch_enabled);
  const [houseOn, setHouseOn] = useState(prefs.house_ads_enabled);
  const sectorName = (s: SectorRow) => (locale === "en" ? s.name_en : s.name);
  const toggle = (code: string) => setBlocked((all) => (all.includes(code) ? all.filter((x) => x !== code) : [...all, code]));

  return (
    <form ref={formRef} noValidate className="flex flex-col gap-7" onSubmit={(e) => e.preventDefault()}>
      <AutoSaveStatus state={saveState} className="-mb-4" />
      <FormError message={top} />
      <input type="hidden" name="autosave" value="1" />
      {section === "main" ? (
        <>
          <section aria-labelledby="blocked-sectors" className="flex flex-col gap-1.5">
            <h2 id="blocked-sectors" className="px-4 text-footnote tracking-wide text-label-secondary uppercase">
              {t("blocked")}
            </h2>
            <div role="group" aria-labelledby="blocked-sectors" className="squircle flex flex-wrap gap-2 rounded-[var(--radius-lg)] bg-grouped-secondary p-3">
              {sectors.map((s) => {
                const on = blocked.includes(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(s.code)}
                    className={cn("pressable min-h-11 rounded-full px-4 text-subheadline", on ? "bg-primary font-semibold text-on-primary" : "bg-fill-tertiary text-label")}
                  >
                    {sectorName(s)}
                  </button>
                );
              })}
            </div>
            <p className="px-4 text-footnote text-label-secondary">{t("blockedHint")}</p>
          </section>
          <ListSection header={t("games")}>
            <ListSwitchRow icon={<ListIcon color="var(--accent-fill)"><Gamepad2 /></ListIcon>} title={t("quiz")} subtitle={t("quizHint")} checked={quiz} onCheckedChange={setQuiz} />
            <ListSwitchRow icon={<ListIcon color="var(--brand-tile)"><Plane /></ListIcon>} title={t("skyCatch")} subtitle={t("skyCatchHint")} checked={sky} onCheckedChange={setSky} />
          </ListSection>
          {house ? (
            <ListSection footer={t("tvNote")}>
              <ListRow
                href={house.href}
                icon={<ListIcon color="var(--orange-fill)"><Megaphone /></ListIcon>}
                title={t("house")}
                subtitle={t("houseRowHint")}
                detail={<span className="tabular">{house.count}</span>}
                accessory="chevron"
              />
            </ListSection>
          ) : null}
        </>
      ) : (
        <ListSection footer={t("houseHint")}>
          <ListSwitchRow icon={<ListIcon color="var(--orange-fill)"><Megaphone /></ListIcon>} title={t("houseSwitch")} checked={houseOn} onCheckedChange={setHouseOn} />
        </ListSection>
      )}
      {blocked.map((code) => (
        <input key={code} type="hidden" name="blockedSectors" value={code} />
      ))}
      <input type="hidden" name="quizEnabled" value={String(quiz)} />
      <input type="hidden" name="skyCatchEnabled" value={String(sky)} />
      <input type="hidden" name="houseAdsEnabled" value={String(houseOn)} />
    </form>
  );
}
