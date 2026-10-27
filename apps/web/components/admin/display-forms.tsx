"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ServiceTile } from "@/components/ui/service-tile";
import { TextField } from "@/components/ui/text-field";
import { useFormErrors } from "./use-form-errors";

type Action = (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
type Service = { id: string; name: string; prefix: string; color: string };

function ServicesPicker({ services, initial, disabled }: { services: Service[]; initial: string[]; disabled?: boolean }) {
  const t = useTranslations("displays");
  const [selected, setSelected] = useState(initial);
  return (
    <>
      <ListSection header={t("services")} footer={t("servicesHint")}>
        {services.map((s) => {
          const checked = selected.includes(s.id);
          return (
            <ListRow
              key={s.id}
              role="checkbox"
              selected={checked}
              onClick={() => !disabled && setSelected((all) => (checked ? all.filter((x) => x !== s.id) : [...all, s.id]))}
              icon={<ServiceTile letter={s.prefix} color={s.color} />}
              title={s.name}
              accessory="check"
            />
          );
        })}
      </ListSection>
      {selected.map((id) => (
        <input key={id} type="hidden" name="serviceIds" value={id} />
      ))}
    </>
  );
}

/** Appairage : code affiché sur l'écran, nom, services affichés (tous par défaut). */
export function PairDisplayForm({ action, services }: { action: Action; services: Service[] }) {
  const t = useTranslations("displays");
  const [state, formAction, pending] = useActionState(action, null);
  const { top, field } = useFormErrors(state);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <TextField
        name="code"
        label={t("code")}
        hint={t("codeHint")}
        error={field("code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        className="[&_input]:text-title2 [&_input]:font-semibold [&_input]:tracking-[0.4em] [&_input]:tabular"
      />
      <TextField name="name" label={t("name")} placeholder={t("namePlaceholder")} error={field("name")} maxLength={60} required />
      <ServicesPicker services={services} initial={services.map((s) => s.id)} />
      <BottomBar>
        <Button type="submit" block loading={pending}>
          {t("pair")}
        </Button>
      </BottomBar>
    </form>
  );
}

export function DisplayForm({ action, services, initial, disabled }: { action: Action; services: Service[]; initial: { name: string; serviceIds: string[] }; disabled?: boolean }) {
  const t = useTranslations("displays");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { top, field } = useFormErrors(state);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <TextField name="name" label={t("name")} defaultValue={initial.name} error={field("name")} maxLength={60} required disabled={disabled} />
      <ServicesPicker services={services} initial={initial.serviceIds} disabled={disabled} />
      {disabled ? null : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
            {ta("save")}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}

export type AnnouncementSettings = {
  languages: ("fr" | "en")[];
  volume: number;
  repeatCount: number;
  chimeEnabled: boolean;
  quiet: { from: string; to: string } | null;
};

/** Annonces vocales : langues, volume, répétitions, carillon, plage de silence. */
export function AnnouncementSettingsForm({ action, initial, disabled }: { action: Action; initial: AnnouncementSettings; disabled?: boolean }) {
  const t = useTranslations("displays");
  const ta = useTranslations("admin");
  const tc = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, null);
  const { top, field } = useFormErrors(state);
  const [v, setV] = useState({ ...initial, quietEnabled: !!initial.quiet });
  const toggleLang = (lang: "fr" | "en", on: boolean) =>
    setV((s) => {
      const next = on ? [...new Set([...s.languages, lang])] : s.languages.filter((l) => l !== lang);
      return { ...s, languages: next.length ? (["fr", "en"] as const).filter((l) => next.includes(l)) : s.languages };
    });

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <ListSection header={t("languages")} footer={t("languagesFooter")}>
        <ListSwitchRow title={tc("french")} checked={v.languages.includes("fr")} onCheckedChange={(on) => toggleLang("fr", on)} disabled={disabled} />
        <ListSwitchRow title={tc("english")} checked={v.languages.includes("en")} onCheckedChange={(on) => toggleLang("en", on)} disabled={disabled} />
      </ListSection>
      <section className="flex flex-col gap-1.5">
        <label htmlFor="volume" className="px-4 text-footnote uppercase text-label-secondary">
          {t("volume")} · <span className="tabular">{v.volume} %</span>
        </label>
        <div className="squircle rounded-[var(--radius-md)] bg-grouped-secondary px-4 py-3">
          <input
            id="volume"
            type="range"
            min={0}
            max={100}
            step={10}
            value={v.volume}
            onChange={(e) => setV({ ...v, volume: Number(e.target.value) })}
            disabled={disabled}
            className="h-11 w-full accent-[var(--accent-fill)]"
          />
        </div>
      </section>
      <section className="flex flex-col gap-1.5">
        <span className="px-4 text-footnote uppercase text-label-secondary">{t("repeat")}</span>
        <SegmentedControl
          label={t("repeat")}
          value={String(v.repeatCount)}
          onValueChange={(r) => setV({ ...v, repeatCount: Number(r) })}
          options={[1, 2, 3].map((n) => ({ value: String(n), label: t("repeatValue", { count: n }) }))}
        />
      </section>
      <ListSection>
        <ListSwitchRow title={t("chime")} checked={v.chimeEnabled} onCheckedChange={(chimeEnabled) => setV({ ...v, chimeEnabled })} disabled={disabled} />
      </ListSection>
      <ListSection header={t("quiet")} footer={t("quietHint")}>
        <ListSwitchRow title={t("quietEnabled")} checked={v.quietEnabled} onCheckedChange={(quietEnabled) => setV({ ...v, quietEnabled })} disabled={disabled} />
      </ListSection>
      {v.quietEnabled ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField type="time" name="quietFrom" label={t("from")} defaultValue={initial.quiet?.from ?? "12:00"} disabled={disabled} />
          <TextField type="time" name="quietTo" label={t("to")} defaultValue={initial.quiet?.to ?? "14:00"} error={field("quietTo")} disabled={disabled} />
        </div>
      ) : null}
      {v.languages.map((l) => (
        <input key={l} type="hidden" name="languages" value={l} />
      ))}
      <input type="hidden" name="volume" value={v.volume} />
      <input type="hidden" name="repeatCount" value={v.repeatCount} />
      <input type="hidden" name="chimeEnabled" value={String(v.chimeEnabled)} />
      <input type="hidden" name="quietEnabled" value={String(v.quietEnabled)} />
      {disabled ? null : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
            {ta("save")}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}
