"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Gamepad2, Megaphone, Plane } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import type { ActionResult } from "@/lib/auth/errors";
import type { SectorRow } from "@/lib/ads/types";

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
      <ListSection header={t("blocked")} footer={t("blockedHint")} checkboxGroupLabel={t("blocked")}>
        {sectors.map((s) => {
          const checked = blocked.includes(s.code);
          return (
            <ListRow
              key={s.code}
              role="checkbox"
              selected={checked}
              onClick={() => setBlocked((all) => (checked ? all.filter((x) => x !== s.code) : [...all, s.code]))}
              title={locale === "en" ? s.name_en : s.name}
              accessory="check"
            />
          );
        })}
      </ListSection>
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
