"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ServiceTile } from "@/components/ui/service-tile";
import { CodeBoxes } from "@/components/ui/code-boxes";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { CopyButton } from "./copy-button";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
import { useFormErrors } from "./use-form-errors";

type Action = (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
type Service = { id: string; name: string; prefix: string; color: string };

function ServicesPicker({ services, initial, disabled }: { services: Service[]; initial: string[]; disabled?: boolean }) {
  const t = useTranslations("displays");
  const [selected, setSelected] = useState(initial);
  return (
    <>
      <ListSection header={t("services")} footer={t("servicesHint")} checkboxGroupLabel={t("services")}>
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

/**
 * Publicité sur l'écran (T1) : annonces de l'établissement et annonceurs validés par Wintek ; les secteurs refusés se
 * règlent dans Publicité (lien).
 */
function ShowAdsSwitch({ initial, adsHref, disabled }: { initial: boolean; adsHref: string; disabled?: boolean }) {
  const t = useTranslations("displays");
  const [on, setOn] = useState(initial);
  return (
    <>
      <ListSection
        footer={
          <>
            {t("showAdsFooter")}{" "}
            <Link href={adsHref} className="inline-flex min-h-11 items-center text-accent-text underline-offset-2 hover:underline">
              {t("showAdsLink")}
            </Link>
          </>
        }
      >
        <ListSwitchRow title={t("showAds")} checked={on} onCheckedChange={setOn} disabled={disabled} />
      </ListSection>
      <input type="hidden" name="showAds" value={String(on)} />
    </>
  );
}

/** Étape numérotée de l'appairage (maquette v2 19). */
function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-3 text-body">
        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-footnote font-semibold text-on-accent">
          {n}
        </span>
        {label}
      </p>
      <div className="pl-10">{children}</div>
    </div>
  );
}

/**
 * Appairage (maquette v2 19) : 1. ouvrir l'adresse sur le téléviseur ; 2. saisir le code à 6 chiffres affiché (six
 * cases). Puis le nom, les services affichés (tous par défaut) et la publicité (activée par défaut).
 */
export function PairDisplayForm({ action, services, adsHref, tvUrl }: { action: Action; services: Service[]; adsHref: string; tvUrl: string }) {
  const t = useTranslations("displays");
  const tq = useTranslations("qr");
  const [state, formAction, pending] = useActionState(action, null);
  const { top, field } = useFormErrors(state);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <Step n={1} label={t("stepOpen")}>
        <div className="squircle flex flex-col overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
          <code className="px-3 py-3 text-subheadline break-all text-accent-text">{tvUrl}</code>
          <div className="hairline-t px-1">
            <CopyButton value={tvUrl} label={tq("copyLink")} copiedLabel={tq("copied")} variant="plain" />
          </div>
        </div>
      </Step>
      <Step n={2} label={t("stepCode")}>
        <CodeBoxes label={t("code")} hint={t("codeHint")} error={field("code")} />
      </Step>
      <FormGroup>
        <TextField grouped name="name" label={t("name")} placeholder={t("namePlaceholder")} error={field("name")} maxLength={60} required />
      </FormGroup>
      <ServicesPicker services={services} initial={services.map((s) => s.id)} />
      <ShowAdsSwitch initial adsHref={adsHref} />
      <BottomBar>
        <Button type="submit" block loading={pending}>
          {t("pair")}
        </Button>
      </BottomBar>
    </form>
  );
}

export function DisplayForm({
  action,
  services,
  initial,
  adsHref,
  disabled,
}: {
  action: Action;
  services: Service[];
  initial: { name: string; serviceIds: string[]; showAds: boolean };
  adsHref: string;
  disabled?: boolean;
}) {
  const t = useTranslations("displays");
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, !disabled);
  const { field } = useFormErrors(saveState.result);
  // Maquette v2 19 : nom, services cochés, publicité ; tout s'enregistre seul.
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="autosave" value="1" />
      {disabled ? null : <AutoSaveStatus state={saveState} className="-mb-3" />}
      <FormGroup>
        <TextField grouped name="name" label={t("name")} defaultValue={initial.name} error={field("name")} maxLength={60} required disabled={disabled} />
      </FormGroup>
      <ServicesPicker services={services} initial={initial.serviceIds} disabled={disabled} />
      <ShowAdsSwitch initial={initial.showAds} adsHref={adsHref} disabled={disabled} />
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
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, !disabled);
  const { field } = useFormErrors(saveState.result);
  const [v, setV] = useState({ ...initial, quietEnabled: !!initial.quiet });
  const toggleLang = (lang: "fr" | "en", on: boolean) =>
    setV((s) => {
      const next = on ? [...new Set([...s.languages, lang])] : s.languages.filter((l) => l !== lang);
      return { ...s, languages: next.length ? (["fr", "en"] as const).filter((l) => next.includes(l)) : s.languages };
    });

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="autosave" value="1" />
      {disabled ? null : <AutoSaveStatus state={saveState} className="-mb-3" />}
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
            className="h-11 w-full" style={{ accentColor: "var(--accent-fill)" }}
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
    </form>
  );
}
